// src/app/api/algorithms/recommendations/route.ts
// Unified recommendations endpoint — auto-selects XSimGCL or GNN-CF
// based on the user's interaction count (cold start detection)
//
// POST /api/algorithms/recommendations
// Body: { userId: string, limit?: number, excludeEventIds?: string[] }

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { XSimGCL } from "@/lib/algorithms/xsimgcl";
import { GNNCrossDomainCF } from "@/lib/algorithms/gnn-cf";
import type { RecommendationOutput, RecommendedEvent, AlgorithmType } from "@/lib/algorithms/shared/types";
import { applyCCR } from "@/lib/algorithms/shared/ccr";

// ─── Input Schema ──────────────────────────────────────────────────────────────

const RecommendationRequestSchema = z.object({
  userId: z.string().uuid("userId must be a valid UUID"),
  limit: z.number().int().min(1).max(20).optional().default(6),
  excludeEventIds: z.array(z.string().uuid()).optional().default([]),
});

// ─── Cold Start Threshold ──────────────────────────────────────────────────────
// If user has fewer than this many interactions, use GNN-CF instead of XSimGCL
const COLD_START_THRESHOLD = 10;

// ─── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Auth — verify JWT
    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Authenticated client — carries the user's JWT so RLS policies apply correctly
    const supabase = createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "true" } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // 2. Validate request body
    const body = await request.json();
    const parsed = RecommendationRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { userId, limit, excludeEventIds } = parsed.data;

    // Security: users can only request recommendations for themselves
    if (userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 3. Count interactions to decide algorithm
    const { count: interactionCount } = await supabase
      .from("user_interactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    const { data: confirmedBookingsData } = await supabase
      .from("bookings")
      .select("event_id")
      .eq("user_id", userId)
      .eq("status", "confirmed");

    // Event IDs the user has already confirmed — exclude from recommendations
    const confirmedEventIds = (confirmedBookingsData ?? []).map(b => b.event_id).filter(Boolean) as string[];

    // Cold start uses ONLY interaction count (the canonical signal table)
    const totalInteractions = interactionCount ?? 0;
    const isColdStart = totalInteractions < COLD_START_THRESHOLD;

    logger.info(
      `[Recommendations] userId=${userId}, interactions=${totalInteractions}, coldStart=${isColdStart}`
    );

    // 4. Check cache — don't re-run within 10 minutes
    const algorithmType = isColdStart ? "gnn-cf" : "xsimgcl";

    const { data: cached } = await supabase
      .from("algorithm_results")
      .select("output_data, created_at")
      .eq("user_id", userId)
      .eq("algorithm_type", algorithmType)
      .gte(
        "created_at",
        new Date(Date.now() - 30 * 60 * 1000).toISOString()
      )
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (cached) {
      const cachedRecs = (cached.output_data as { recommendations?: unknown[] })?.recommendations ?? [];
      if (cachedRecs.length > 0) {
        logger.info(`[Recommendations] Returning cached result for userId=${userId}`);
        return NextResponse.json({
          success: true,
          ...cached.output_data,
          algorithm: algorithmType,
          cached: true,
        });
      }
      logger.info(`[Recommendations] Cached result empty — re-running for userId=${userId}`);
    }

    // 5. Run algorithm — pass the authenticated supabase client so RLS is satisfied
    // Merge confirmed bookings into excludeEventIds so algorithms don't recommend already-booked events
    const effectiveExcludeIds = [...new Set([...excludeEventIds, ...confirmedEventIds])];
    let result: RecommendationOutput;

    if (isColdStart) {
      const algo = new GNNCrossDomainCF();
      result = await algo.execute({
        userId,
        limit,
        excludeEventIds: effectiveExcludeIds,
        supabaseClient: supabase,
      });
    } else {
      const algo = new XSimGCL();
      result = await algo.execute({
        userId,
        limit,
        excludeEventIds: effectiveExcludeIds,
        supabaseClient: supabase,
      });
    }

    // 5.5 Augment with UX-07 explainability reasons
    type RecWithReason = { eventId: string; score: number; rank: number; algorithm: AlgorithmType; reason?: string };
    let finalRecs: RecWithReason[] = result.recommendations as RecWithReason[];

    if (isColdStart) {
      finalRecs = finalRecs.map(r => ({ ...r, reason: "Trending in your area" }));
    } else {
      // Build frequency map of tags the user has interacted with
      const { data: userInteractions } = await supabase
        .from("user_interactions")
        .select("events(tags)")
        .eq("user_id", userId);

      const tagCounts = new Map<string, number>();
      if (userInteractions) {
        for (const row of userInteractions) {
          const evt = (Array.isArray(row.events) ? row.events[0] : row.events) as { tags?: string[] } | null;
          const tags = evt?.tags || [];
          for (const t of tags) {
            tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
          }
        }
      }

      // Fetch tags of recommended events
      const recEventIds = finalRecs.map(r => r.eventId);
      if (recEventIds.length > 0) {
        const { data: recEvents } = await supabase
          .from("events")
          .select("id, tags")
          .in("id", recEventIds);

        const recTagsMap = new Map((recEvents || []).map(e => [e.id, e.tags || []]));

        finalRecs = finalRecs.map(r => {
          const eTags = recTagsMap.get(r.eventId) || [];
          let bestTag = "";
          let bestCount = 0;
          for (const tag of eTags) {
            const count = tagCounts.get(tag) || 0;
            if (count > bestCount) {
              bestCount = count;
              bestTag = tag;
            }
          }

          const reason = bestCount > 0 
            ? `Based on your interest in ${bestTag.toLowerCase()}`
            : "Recommended by XSimGCL";

          return { ...r, reason };
        });
      }
    }

    // 5.6 Apply CCR Re-ranking
    if (finalRecs.length > 0) {
      const recIds = finalRecs.map(r => r.eventId);
      const { data: ccrData } = await supabase
        .from("events")
        .select("id, attendee_count, max_attendees, start_date")
        .in("id", recIds);
        
      if (ccrData) {
        const ccrMap = new Map(ccrData.map(e => [e.id, e]));
        finalRecs = applyCCR(finalRecs as Parameters<typeof applyCCR>[0], ccrMap) as RecWithReason[];
      }
    }

    result.recommendations = finalRecs as RecommendedEvent[];

    // 6. Persist result to algorithm_results (paper experiment log)
    await supabase.from("algorithm_results").insert({
      user_id: userId,
      algorithm_type: algorithmType,
      input_data: {
        userId,
        limit,
        interactionCount: totalInteractions,
      },
      output_data: {
        recommendations: result.recommendations,
        coldStart: result.coldStart,
      },
      execution_time_ms: result.metrics.executionTimeMs,
      version: "1.0.0",
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });

    logger.info(
      `[Recommendations] Completed in ${Date.now() - startTime}ms via ${algorithmType}`
    );

    return NextResponse.json({
      success: true,
      recommendations: result.recommendations,
      coldStart: result.coldStart,
      algorithm: algorithmType,
      executionTimeMs: result.metrics.executionTimeMs,
    });
  } catch (err: unknown) {
    logger.error("[Recommendations] Error:", err);
    return NextResponse.json(
      {
        error: "Failed to generate recommendations",
        details:
          err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}