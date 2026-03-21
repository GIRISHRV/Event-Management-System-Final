// src/lib/algorithms/gnn-cf/index.ts
// GNN Cross-Domain Collaborative Filtering for cold-start event recommendations
//
// Paper: "Cross-Domain Recommendation via Preference Propagation GraphNet"
//        IEEE Transactions, 2024 — https://ieeexplore.ieee.org/document/10452478
//
// When a user has fewer than COLD_START_THRESHOLD interactions in Domain A
// (user-event), this algorithm:
//   1. Builds Domain B graph (user-vendor from service_requests)
//   2. Propagates 2-layer GNN on each domain to get user embeddings
//   3. Computes cross-domain attention gate α based on embedding alignment
//   4. Blends Domain A + Domain B embeddings: h_cross = α·h_B + (1-α)·h_A
//   5. Scores candidate events via:
//        - Category-tag bridge (vendor category tokens ↔ event tag tokens)
//        - Cosine similarity in cross-domain embedding space
//        - Small popularity blend (λ=0.15)

import type {
  AlgorithmBase,
  AlgorithmMetrics,
  RecommendationInput,
  RecommendationOutput,
  RecommendedEvent,
  ValidationResult,
} from "../shared/types";
import {
  buildDomainAGraph,
  buildDomainBGraph,
  extractVendorSignals,
  fetchCandidateEventsWithFeatures,
} from "./graph-builder";
import {
  initEmbeddingsForGraph,
  gnnPropagate,
  crossDomainAttentionGate,
  blendEmbeddings,
  buildCategoryProfile,
  scoreEventsCrossDomain,
  DEFAULT_GNN_CF_CONFIG,
  type GNNCFConfig,
} from "./cross-attention";

export class GNNCrossDomainCF
  implements AlgorithmBase<RecommendationInput, RecommendationOutput>
{
  readonly name = "GNNCrossDomainCF";
  readonly version = "1.0.0";

  private config: GNNCFConfig;

  private metrics: AlgorithmMetrics = {
    executionTimeMs: 0,
    inputSize: 0,
    outputSize: 0,
    version: this.version,
    timestamp: new Date(),
  };

  constructor(config: Partial<GNNCFConfig> = {}) {
    this.config = { ...DEFAULT_GNN_CF_CONFIG, ...config };
  }

  // ─── Validation ──────────────────────────────────────────────────────────────

  validate(input: RecommendationInput): ValidationResult {
    const errors: string[] = [];
    if (!input.userId || typeof input.userId !== "string") {
      errors.push("userId is required and must be a string");
    }
    if (
      input.limit !== undefined &&
      (input.limit < 1 || input.limit > 50)
    ) {
      errors.push("limit must be between 1 and 50");
    }
    if (!input.supabaseClient) {
      errors.push("supabaseClient is required — pass the authenticated client from the API route");
    }
    return { isValid: errors.length === 0, errors };
  }

  // ─── Execute ─────────────────────────────────────────────────────────────────

  async execute(input: RecommendationInput): Promise<RecommendationOutput> {
    const start = Date.now();

    const validation = this.validate(input);
    if (!validation.isValid) {
      throw new Error(
        `[GNN-CF] Invalid input: ${validation.errors.join(", ")}`
      );
    }

    const { supabaseClient } = input;
    const limit = input.limit ?? 6;
    const excludeIds = new Set(input.excludeEventIds ?? []);

    // ── Step 1: Build Domain A (user-event, sparse for cold-start users) ──────
    const [domainA, domainB, vendorSignals] = await Promise.all([
      buildDomainAGraph(input.userId, supabaseClient),
      buildDomainBGraph(input.userId, supabaseClient),
      extractVendorSignals(input.userId, supabaseClient),
    ]);

    this.metrics.inputSize =
      domainA.interactionCount + domainB.interactionCount;

    // ── Step 2: GNN propagation on Domain A ──────────────────────────────────
    let stateA = initEmbeddingsForGraph(
      domainA.graph,
      this.config.embeddingDim
    );
    if (domainA.interactionCount > 0) {
      stateA = gnnPropagate(domainA.graph, stateA, this.config.gnnLayers);
    }
    // User embedding from Domain A (null if graph has no edges — pure cold start)
    const userEmbA =
      domainA.interactionCount > 0
        ? (stateA.userEmbeddings.get(input.userId) ?? null)
        : null;

    // ── Step 3: GNN propagation on Domain B ──────────────────────────────────
    let userEmbB: number[] | null = null;

    if (domainB.interactionCount > 0) {
      let stateB = initEmbeddingsForGraph(
        domainB.graph,
        this.config.embeddingDim
      );
      stateB = gnnPropagate(domainB.graph, stateB, this.config.gnnLayers);
      userEmbB = stateB.userEmbeddings.get(input.userId) ?? null;
    }

    // ── Step 4: Cross-domain attention gate ──────────────────────────────────
    const alpha = crossDomainAttentionGate(
      userEmbA,
      userEmbB,
      this.config.embeddingDim
    );

    // ── Step 5: Blend embeddings ──────────────────────────────────────────────
    const crossUserEmbedding = blendEmbeddings(
      userEmbA,
      userEmbB,
      alpha,
      this.config.embeddingDim
    );

    // ── Step 6: Build category profile from vendor signals ────────────────────
    const categoryProfile = buildCategoryProfile(vendorSignals);

    // ── Step 7: Fetch candidate events ───────────────────────────────────────
    const alreadySeen = new Set([
      ...domainA.itemIds,   // already interacted with in Domain A
      ...excludeIds,
    ]);

    const candidates = await fetchCandidateEventsWithFeatures(
      [...alreadySeen],
      supabaseClient
    );

    if (candidates.length === 0) {
      this.metrics = this.buildMetrics(start, 0);
      return {
        recommendations: [],
        coldStart: true,
        metrics: this.metrics,
      };
    }

    // ── Step 8: Score candidates ──────────────────────────────────────────────
    const scored = scoreEventsCrossDomain(
      crossUserEmbedding,
      alpha,
      categoryProfile,
      candidates,
      stateA.itemEmbeddings,
      this.config
    );

    // ── Step 9: Build output ──────────────────────────────────────────────────
    const recommendations: RecommendedEvent[] = scored
      .slice(0, limit)
      .map((s, rank) => ({
        eventId: s.eventId,
        score: s.score,
        rank: rank + 1,
        algorithm: "gnn-cf" as const,
      }));

    this.metrics = this.buildMetrics(start, recommendations.length);

    return {
      recommendations,
      coldStart: true,   // this algorithm is always invoked for cold-start users
      metrics: this.metrics,
    };
  }

  // ─── Metrics ─────────────────────────────────────────────────────────────────

  getMetrics(): AlgorithmMetrics {
    return this.metrics;
  }

  private buildMetrics(startMs: number, outputSize: number): AlgorithmMetrics {
    return {
      executionTimeMs: Date.now() - startMs,
      inputSize: this.metrics.inputSize,
      outputSize,
      version: this.version,
      timestamp: new Date(),
    };
  }
}
