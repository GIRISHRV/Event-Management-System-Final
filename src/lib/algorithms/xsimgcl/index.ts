// src/lib/algorithms/xsimgcl/index.ts
// XSimGCL: Extremely Simple Graph Contrastive Learning for Recommendation
//
// Paper: Yu et al., IEEE TKDE Vol.36 No.2 pp.913-926, 2024
// DOI:   10.1109/TKDE.2023.3288135
// arXiv: https://arxiv.org/abs/2209.02544
//
// Adaptation: Applied to event management — users are event attendees,
// items are events, interactions come from bookings/views/favorites.
//
// KEY FIX: fetchCandidateEvents now receives [...interactedIds] so that
// events the user has already interacted with are excluded from the candidate
// pool BEFORE scoring. Previously [] was passed, meaning training-set events
// could appear in the top-10 output and inflate NDCG when evaluated.

import type {
  AlgorithmBase,
  AlgorithmMetrics,
  RecommendationInput,
  RecommendationOutput,
  RecommendedEvent,
  ValidationResult,
} from "../shared/types";
import { buildUserGraph, fetchCandidateEvents } from "./graph-builder";
import {
  initEmbeddings,
  lightgcnPropagate,
  scoreEvents,
  DEFAULT_ENCODER_CONFIG,
  type EncoderConfig,
  type EncoderState,
} from "./encoder";

import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

function serializeEmbeddings(state: EncoderState) {
  return {
    userEmbeddings: Array.from(state.userEmbeddings.entries()),
    eventEmbeddings: Array.from(state.eventEmbeddings.entries()),
    config: state.config,
  };
}

function deserializeEmbeddings(data: { userEmbeddings?: [string, number[]][]; eventEmbeddings?: [string, number[]][]; config?: EncoderConfig }): EncoderState {
  return {
    userEmbeddings: new Map(data.userEmbeddings || []),
    eventEmbeddings: new Map(data.eventEmbeddings || []),
    config: data.config || DEFAULT_ENCODER_CONFIG,
  };
}

async function saveEmbeddings(supabaseClient: SupabaseClient, state: EncoderState) {
  try {
    // 1. Replace the short-lived cache row (used for fast recall within TTL)
    await supabaseClient
      .from("algorithm_results")
      .delete()
      .eq("algorithm_type", "xsimgcl-embeddings");

    await supabaseClient.from("algorithm_results").insert({
      algorithm_type: "xsimgcl-embeddings",
      input_data: {},
      output_data: serializeEmbeddings(state),
      version: "1.0.0",
    });

    // 2. Persist a training-log row so trained weights survive cache expiry.
    //    We insert (not upsert) so history is preserved; the most recent is
    //    loaded on the next cold-start (see execute() below).
    await supabaseClient.from("algorithm_results").insert({
      algorithm_type: "xsimgcl-training-log",
      input_data: {},
      output_data: serializeEmbeddings(state),
      version: "1.0.0",
    });
  } catch (err) {
    logger.error("[XSimGCL] saveEmbeddings failed", err);
  }
}

export class XSimGCL implements AlgorithmBase<RecommendationInput, RecommendationOutput> {
  readonly name = "XSimGCL";
  readonly version = "1.0.0";

  private metrics: AlgorithmMetrics = {
    executionTimeMs: 0,
    inputSize: 0,
    outputSize: 0,
    version: this.version,
    timestamp: new Date(),
  };

  private encoderConfig: EncoderConfig;

  constructor(config: Partial<EncoderConfig> = {}) {
    this.encoderConfig = { ...DEFAULT_ENCODER_CONFIG, ...config };
  }

  validate(input: RecommendationInput): ValidationResult {
    const errors: string[] = [];
    if (!input.userId || typeof input.userId !== "string") {
      errors.push("userId is required and must be a string");
    }
    if (input.limit !== undefined && (input.limit < 1 || input.limit > 50)) {
      errors.push("limit must be between 1 and 50");
    }
    if (!input.supabaseClient) {
      errors.push(
        "supabaseClient is required — pass the authenticated client from the API route"
      );
    }
    return { isValid: errors.length === 0, errors };
  }

  async execute(input: RecommendationInput): Promise<RecommendationOutput> {
    const start = Date.now();

    const validation = this.validate(input);
    if (!validation.isValid) {
      throw new Error(`[XSimGCL] Invalid input: ${validation.errors.join(", ")}`);
    }

    const { supabaseClient } = input;
    const limit = input.limit ?? 6;
    const excludeIds = new Set(input.excludeEventIds ?? []);

    // 1. Build bipartite interaction graph for this user
    // In eval mode, pass the cutoff date so only training-window bookings
    // are included. This prevents test-window bookings from being added to
    // interactedIds and excluded from the candidate pool.
    const evalMode = (input as RecommendationInput & { evalMode?: boolean; cutoffDate?: string }).evalMode === true;
    const cutoffDate = (input as RecommendationInput & { evalMode?: boolean; cutoffDate?: string }).cutoffDate;

    const { graph, userIds, eventIds, interactionCount } = await buildUserGraph(
      input.userId,
      supabaseClient,
      evalMode ? cutoffDate : undefined
    );

    this.metrics.inputSize = interactionCount;

    // 2. Build the full set of IDs to exclude from recommendations:
    //    - Events this user has already interacted with (from the graph)
    //    - Events explicitly excluded by the caller (e.g. confirmed bookings)
    //
    //    KEY FIX: We pass interactedIds into fetchCandidateEvents so these
    //    events are filtered out of the candidate pool before any scoring.
    //    Previously [] was passed here, which allowed training-set events to
    //    appear in recommendations and be "correctly predicted" by the model
    //    (leakage — the model had already seen them during graph propagation).
    const interactedIds = new Set(eventIds);
    for (const id of excludeIds) interactedIds.add(id);

    // 3. Fetch candidate events — already excludes interacted + explicitly excluded
    const candidates = await fetchCandidateEvents(
      [...interactedIds],
      supabaseClient,
      { upcomingOnly: !evalMode }
    );
    const candidateIds = candidates.map(c => c.id);

    if (process.env.NODE_ENV === "development") {
      logger.debug(
        `[XSimGCL] interactedIds=${interactedIds.size}, candidates=${candidateIds.length}`
      );
    }

    // 4. Initialise or load embeddings from cache
    const { data: cached } = await supabaseClient
      .from("algorithm_results")
      .select("output_data")
      .eq("algorithm_type", "xsimgcl-embeddings")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const allEventIds = [...new Set([...eventIds, ...candidateIds])];
    let state: EncoderState;

    if (cached?.output_data) {
      state = deserializeEmbeddings(cached.output_data);
      // Add vectors for newly seen users/events not in the saved state
      const newUserIds = userIds.filter(id => !state.userEmbeddings.has(id));
      const newEventIds = allEventIds.filter(id => !state.eventEmbeddings.has(id));
      if (newUserIds.length > 0 || newEventIds.length > 0) {
        const newState = initEmbeddings(newUserIds, newEventIds, this.encoderConfig);
        for (const [id, emb] of newState.userEmbeddings.entries()) {
          state.userEmbeddings.set(id, emb);
        }
        for (const [id, emb] of newState.eventEmbeddings.entries()) {
          state.eventEmbeddings.set(id, emb);
        }
      }
    } else {
      // No cached embeddings — check for a persisted training-log before
      // falling back to Xavier random init. This prevents losing all training
      // progress when the short-lived xsimgcl-embeddings cache row expires.
      const { data: trainingLog } = await supabaseClient
        .from("algorithm_results")
        .select("output_data")
        .eq("algorithm_type", "xsimgcl-training-log")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (trainingLog?.output_data) {
        logger.info("[XSimGCL] Cache miss — restoring from training-log");
        state = deserializeEmbeddings(trainingLog.output_data);
        // Patch in any users/events not present in the saved state
        const newUserIds = userIds.filter(id => !state.userEmbeddings.has(id));
        const newEventIds = allEventIds.filter(id => !state.eventEmbeddings.has(id));
        if (newUserIds.length > 0 || newEventIds.length > 0) {
          const patch = initEmbeddings(newUserIds, newEventIds, this.encoderConfig);
          for (const [id, emb] of patch.userEmbeddings.entries()) state.userEmbeddings.set(id, emb);
          for (const [id, emb] of patch.eventEmbeddings.entries()) state.eventEmbeddings.set(id, emb);
        }
      } else {
        // No training history either — Xavier random init (true cold start)
        logger.info("[XSimGCL] No training-log found — Xavier random init");
        state = initEmbeddings(userIds, allEventIds, this.encoderConfig);
      }
    }

    // 5. LightGCN propagation over the interaction graph
    state = lightgcnPropagate(graph, state);

    // Persist updated embeddings for next request (cache)
    await saveEmbeddings(supabaseClient, state);

    // 6. Get user embedding
    const userEmbedding = state.userEmbeddings.get(input.userId);

    if (process.env.NODE_ENV === "development") {
      logger.debug(
        `[XSimGCL] userEmbedding=${!!userEmbedding}, candidates=${candidateIds.length}`
      );
    }

    if (!userEmbedding) {
      // No interactions — should have been caught by cold-start routing
      return {
        recommendations: [],
        coldStart: false,
        metrics: this.getMetrics(),
      };
    }

    // 7. Score candidates — excludeIds here is empty because fetchCandidateEvents
    //    already removed all interacted events from candidateIds. We pass an
    //    empty Set so scoreEvents doesn't double-filter, but this is now safe.
    const scored = scoreEvents(
      userEmbedding,
      state.eventEmbeddings,
      candidateIds,
      new Set<string>() // candidates are already clean
    );

    if (process.env.NODE_ENV === "development") {
      logger.debug(
        `[XSimGCL] scored=${scored.length}, top3=${JSON.stringify(
          scored.slice(0, 3).map(s => ({
            id: s.eventId.slice(0, 8),
            score: s.score.toFixed(4),
          }))
        )}`
      );
    }

    // 8. Build output
    const recommendations: RecommendedEvent[] = scored
      .slice(0, limit)
      .map((s, rank) => ({
        eventId: s.eventId,
        score: Math.max(0, Math.min(1, (s.score + 1) / 2)), // normalise [-1,1] → [0,1]
        rank: rank + 1,
        algorithm: "xsimgcl" as const,
      }));

    this.metrics = {
      executionTimeMs: Date.now() - start,
      inputSize: interactionCount,
      outputSize: recommendations.length,
      version: this.version,
      timestamp: new Date(),
    };

    return {
      recommendations,
      coldStart: false,
      metrics: this.metrics,
    };
  }

  getMetrics(): AlgorithmMetrics {
    return this.metrics;
  }
}