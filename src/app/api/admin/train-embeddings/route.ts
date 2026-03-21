// POST /api/admin/train-embeddings
// Runs the BPR training loop on XSimGCL embeddings using all user_interactions data.
// Returns the epoch loss curve for monitoring.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  initEmbeddings,
  lightgcnPropagate,
  trainBPR,
  DEFAULT_ENCODER_CONFIG,
  type EncoderState,
  type BPRInteraction,
} from "@/lib/algorithms/xsimgcl/encoder";
import { buildBipartiteGraph } from "@/lib/algorithms/shared/graph";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const supabase = createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // Auth check — admin only
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    if (user.app_metadata?.role !== "admin") {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (!profile || profile.role !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const start = Date.now();

    // 1. Fetch all user_interactions
    const { data: interactions, error: intError } = await supabase
      .from("user_interactions")
      .select("user_id, event_id, implicit_score")
      .not("event_id", "is", null);

    if (intError) {
      return NextResponse.json({ error: intError.message }, { status: 500 });
    }

    if (!interactions || interactions.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No interactions found — nothing to train on",
        lossPerEpoch: [],
      });
    }

    // 2. Build graph for LightGCN propagation
    const userIds = [...new Set(interactions.map(i => i.user_id))];
    const eventIds = [...new Set(interactions.map(i => i.event_id).filter(Boolean))];

    const records = interactions
      .filter(i => i.event_id)
      .map(i => ({
        userId: i.user_id,
        targetId: i.event_id,
        weight: i.implicit_score ?? 0.3,
      }));

    const graph = buildBipartiteGraph(userIds, eventIds, records, "event");

    // 3. Load existing embeddings or init fresh
    const { data: cached } = await supabase
      .from("algorithm_results")
      .select("output_data")
      .eq("algorithm_type", "xsimgcl-embeddings")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let state: EncoderState;
    if (cached?.output_data) {
      // Deserialize from cache
      state = {
        userEmbeddings: new Map<string, number[]>(cached.output_data.userEmbeddings || []),
        eventEmbeddings: new Map<string, number[]>(cached.output_data.eventEmbeddings || []),
        config: cached.output_data.config || DEFAULT_ENCODER_CONFIG,
      };
      // Add any new users/events not in cached state
      const newUsers = userIds.filter(id => !state.userEmbeddings.has(id));
      const newEvents = eventIds.filter(id => !state.eventEmbeddings.has(id));
      if (newUsers.length > 0 || newEvents.length > 0) {
        const fresh = initEmbeddings(newUsers, newEvents, DEFAULT_ENCODER_CONFIG);
        for (const [id, emb] of fresh.userEmbeddings) state.userEmbeddings.set(id, emb);
        for (const [id, emb] of fresh.eventEmbeddings) state.eventEmbeddings.set(id, emb);
      }
    } else {
      state = initEmbeddings(userIds, eventIds, DEFAULT_ENCODER_CONFIG);
    }

    // 4. LightGCN propagation first (structure-aware starting point)
    state = lightgcnPropagate(graph, state);

    // 5. BPR training
    const bprInteractions: BPRInteraction[] = interactions
      .filter(i => i.event_id)
      .map(i => ({
        userId: i.user_id,
        eventId: i.event_id,
        score: i.implicit_score ?? 0.3,
      }));

    const body = await request.json().catch(() => ({}));
    const epochs = Math.min(body.epochs ?? 15, 50);
    const lr = body.lr ?? 0.005;

    const result = trainBPR(state, bprInteractions, epochs, lr);

    // 6. Save trained embeddings
    await supabase
      .from("algorithm_results")
      .delete()
      .eq("algorithm_type", "xsimgcl-embeddings");

    await supabase.from("algorithm_results").insert({
      algorithm_type: "xsimgcl-embeddings",
      input_data: { trainedAt: new Date().toISOString(), epochs, lr },
      output_data: {
        userEmbeddings: Array.from(result.state.userEmbeddings.entries()),
        eventEmbeddings: Array.from(result.state.eventEmbeddings.entries()),
        config: result.state.config,
      },
      version: "1.0.0",
    });

    // (Removed) Do not brutally invalidate all algorithm_results here, as it zeroes out the evaluator's test pool

    const elapsed = Date.now() - start;

    // Log the training run separately from standard predictions
    await supabase.from("algorithm_results").insert({
      algorithm_type: "xsimgcl-training-log",
      input_data: { action: "bpr-training", epochs, lr, interactions: bprInteractions.length },
      output_data: {
        lossPerEpoch: result.lossPerEpoch,
        totalEpochs: result.totalEpochs,
        finalLoss: result.lossPerEpoch[result.lossPerEpoch.length - 1] ?? 0,
      },
      execution_time_ms: elapsed,
      version: "1.0.0",
    });

    return NextResponse.json({
      success: true,
      lossPerEpoch: result.lossPerEpoch,
      totalEpochs: result.totalEpochs,
      finalLoss: result.lossPerEpoch[result.lossPerEpoch.length - 1] ?? 0,
      interactionsUsed: bprInteractions.length,
      usersInGraph: userIds.length,
      eventsInGraph: eventIds.length,
      executionTimeMs: elapsed,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Training failed" },
      { status: 500 }
    );
  }
}
