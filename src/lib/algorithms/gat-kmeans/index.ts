// src/lib/algorithms/gat-kmeans/index.ts
// GATKMeans: Graph Attention Network + K-Means community detection
//
// Paper: GAT + K-Means for Event Community Detection, IEEE 2024
//        https://ieeexplore.ieee.org/document/10543468/

import type {
  AlgorithmBase,
  AlgorithmMetrics,
  CommunityDetectionInput,
  CommunityDetectionOutput,
  ValidationResult,
} from "../shared/types";
import { computeModularity } from "../shared/graph";
import { silhouetteCoefficient } from "../shared/evaluation";
import { buildEventCommunityGraph } from "./graph";
import { runGAT, DEFAULT_GAT_CONFIG, type GATConfig } from "./attention";
import { kMeans, chooseOptimalK, buildCommunities } from "./clustering";

export class GATKMeans
  implements AlgorithmBase<CommunityDetectionInput, CommunityDetectionOutput>
{
  readonly name = "GATKMeans";
  readonly version = "1.0.0";

  private config: GATConfig;

  private metrics: AlgorithmMetrics = {
    executionTimeMs: 0,
    inputSize: 0,
    outputSize: 0,
    version: this.version,
    timestamp: new Date(),
  };

  constructor(config: Partial<GATConfig> = {}) {
    this.config = { ...DEFAULT_GAT_CONFIG, ...config };
  }

  validate(input: CommunityDetectionInput): ValidationResult {
    const errors: string[] = [];
    if (!input.events || input.events.length === 0) {
      errors.push("events array is required and must not be empty");
    }
    if (
      input.kRange &&
      (input.kRange[0] < 2 || input.kRange[1] > 20 || input.kRange[0] > input.kRange[1])
    ) {
      errors.push("kRange must be [min, max] with 2 ≤ min ≤ max ≤ 20");
    }
    return { isValid: errors.length === 0, errors };
  }

  async execute(
    input: CommunityDetectionInput
  ): Promise<CommunityDetectionOutput> {
    const start = Date.now();

    const validation = this.validate(input);
    if (!validation.isValid) {
      throw new Error(`[GATKMeans] Invalid input: ${validation.errors.join(", ")}`);
    }

    this.metrics.inputSize = input.events.length;

    // ── Step 1: Build event-event similarity graph ────────────────────────────
    // (graph built from input.events, not fetching from DB again — caller
    //  passes events already fetched in the API route)
    const { graph, events: enrichedEvents } = await buildEventCommunityGraph(
      300,
      undefined,
      input.geographicDecay ?? true
    );

    if (enrichedEvents.length === 0) {
      const empty: CommunityDetectionOutput = {
        communities: [],
        modularity: 0,
        numCommunities: 0,
        metrics: this.buildMetrics(start, 0),
      };
      return empty;
    }

    // ── Step 2: GAT — learn attention-weighted event embeddings ───────────────
    const embeddingMap = runGAT(graph, enrichedEvents, this.config);

    // Order embeddings to match enrichedEvents order
    const embeddings = enrichedEvents.map(
      (e) => embeddingMap.get(e.id) ?? new Array(this.config.hiddenDim).fill(0)
    );

    // ── Step 3: Choose optimal K (dynamic, scales with event count) ──────────
    const eventCount = enrichedEvents.length;
    // K = min(6, floor(sqrt(eventCount / 2))), clamped to [2, eventCount]
    const dynamicKMax = Math.max(2, Math.min(6, Math.floor(Math.sqrt(eventCount / 2))));
    const kRange = input.kRange ?? [2, dynamicKMax];
    const effectiveKRange: [number, number] = [
      Math.min(kRange[0], dynamicKMax),
      Math.min(kRange[1], dynamicKMax),
    ];
    const optimalK = chooseOptimalK(embeddings, effectiveKRange);

    // ── Step 4: K-Means clustering ────────────────────────────────────────────
    const { assignments } = kMeans(embeddings, optimalK);

    // ── Step 5: Build community objects with labels ───────────────────────────
    let communities = buildCommunities(enrichedEvents, assignments, optimalK);

    // ── Step 5.5: Filter singleton communities ─────────────────────────────────
    const singletonCount = communities.filter((c) => c.size === 1).length;
    const nonSingletonCommunities = communities.filter((c) => c.size > 1);

    // ── Step 6: Compute modularity for each community ─────────────────────────
    const communityMap = new Map<number, number>(); // nodeIndex → communityId
    enrichedEvents.forEach((e, i) => {
      const node = graph.nodes.find((n) => n.id === e.id);
      if (node) communityMap.set(node.index, assignments[i]);
    });

    const overallModularity = computeModularity(graph, communityMap);

    // Distribute modularity score to each non-singleton community
    communities = nonSingletonCommunities.map((c) => ({
      ...c,
      modularity: overallModularity,
    }));

    // ── Step 4.5: Compute Silhouette coefficient ──────────────────────────────
    // Only meaningful when there are ≥ 2 non-singleton communities
    const silhouette =
      communities.length >= 2
        ? silhouetteCoefficient(embeddings, assignments)
        : 0;

    this.metrics = this.buildMetrics(start, communities.length);

    return {
      communities,
      modularity: overallModularity,
      silhouette,
      numCommunities: communities.length,
      singletonCount,
      metrics: this.metrics,
    };
  }

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
