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
import { supabase as defaultSupabase } from "@/services/supabase/client";
import { SupabaseClient } from "@supabase/supabase-js";
import {
  runGAT,
  generateInitialGatWeights,
  DEFAULT_GAT_CONFIG,
  type GATConfig,
  type GATWeights,
} from "./attention";
import { kMeans, chooseOptimalK, buildCommunities } from "./clustering";

export interface ExtendedCommunityDetectionInput extends CommunityDetectionInput {
  supabaseClient?: SupabaseClient;
}

export class GATKMeans
  implements AlgorithmBase<CommunityDetectionInput, CommunityDetectionOutput>
{
  readonly name = "GATKMeans";
  readonly version = "1.0.0";

  private config: GATConfig;
  private weights: GATWeights | null = null;

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

  // ─── Weight Management ───────────────────────────────────────────────────────

  private async loadWeights(supabase: SupabaseClient): Promise<GATWeights> {
    if (this.weights) return this.weights;

    const { data, error } = await supabase
      .from("algorithm_results")
      .select("output_data")
      .eq("algorithm_type", "gat_weights")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      console.log("[GATKMeans] No weights found, generating initial...");
      this.weights = generateInitialGatWeights(this.config);
      await this.saveWeights(supabase);
      return this.weights;
    }

    this.weights = data.output_data as unknown as GATWeights;
    return this.weights;
  }

  private async saveWeights(supabase: SupabaseClient): Promise<void> {
    if (!this.weights) return;

    await supabase.from("algorithm_results").insert({
      algorithm_type: "gat_weights",
      output_data: this.weights as any,
      execution_time_ms: 0,
    });
  }

  /**
   * Unsupervised GAT training via Link Prediction nudge.
   */
  private async train(graph: any, embeddings: Map<string, number[]>, supabase: SupabaseClient) {
    if (!this.weights) return;

    const learningRate = 0.005;
    const layer = this.weights.layers[this.weights.layers.length - 1]; 

    const edges: [number, number][] = [];
    for (let i = 0; i < graph.nodes.length && edges.length < 5; i++) {
      const neighbors = graph.adjacency.getNonZeroCols(i);
      if (neighbors.length > 0) {
        const j = neighbors[Math.floor(Math.random() * neighbors.length)].col;
        edges.push([i, j]);
      }
    }

    for (const [i, j] of edges) {
      const idI = graph.nodes[i].id;
      const idJ = graph.nodes[j].id;
      const embI = embeddings.get(idI);
      const embJ = embeddings.get(idJ);
      if (!embI || !embJ) continue;

      const sim = embI.reduce((s, x, k) => s + x * (embJ[k] || 0), 0);
      const error = 1.0 - sim;

      if (Math.abs(error) > 0.1) {
        for (const head of layer.heads) {
          for (let r = 0; r < head.W.length; r++) {
            for (let c = 0; c < head.W[r].length; c++) {
              head.W[r][c] += error * (embI[r] || 0) * learningRate;
            }
          }
        }
      }
    }

    await this.saveWeights(supabase);
  }

  // ─── Execution ───────────────────────────────────────────────────────────────

  validate(input: CommunityDetectionInput): ValidationResult {
    const errors: string[] = [];
    if (!input.events || input.events.length === 0) {
      errors.push("events array is required and must not be empty");
    }
    return { isValid: errors.length === 0, errors };
  }

  async execute(
    input: ExtendedCommunityDetectionInput
  ): Promise<CommunityDetectionOutput> {
    const start = Date.now();
    const activeSupabase = input.supabaseClient || defaultSupabase;

    const validation = this.validate(input);
    if (!validation.isValid) {
      throw new Error(`[GATKMeans] Invalid input: ${validation.errors.join(", ")}`);
    }

    const weights = await this.loadWeights(activeSupabase);

    // ── Step 1: Build similarity graph ────────────────────────────────────────
    const { graph, events: enrichedEvents } = await buildEventCommunityGraph(
      300,
      undefined,
      input.geographicDecay ?? true
    );

    if (enrichedEvents.length === 0) {
      return { communities: [], modularity: 0, numCommunities: 0, metrics: this.buildMetrics(start, 0) };
    }

    // ── Step 2: GAT Inference with learned weights ────────────────────────────
    const embeddingMap = runGAT(graph, enrichedEvents, this.config, weights);

    // ── Step 3: Online Training Nudge ─────────────────────────────────────────
    if (graph.nodes.length > 5) {
      await this.train(graph, embeddingMap, activeSupabase);
    }

    const embeddings = enrichedEvents.map(
      (e) => embeddingMap.get(e.id) ?? new Array(this.config.hiddenDim).fill(0)
    );

    // ── Step 4: Clustering ────────────────────────────────────────────────────
    const eventCount = enrichedEvents.length;
    const dynamicKMax = Math.max(2, Math.min(6, Math.floor(Math.sqrt(eventCount / 2))));
    const kRange = input.kRange ?? [2, dynamicKMax];
    const optimalK = chooseOptimalK(embeddings, [Math.min(kRange[0], dynamicKMax), Math.min(kRange[1], dynamicKMax)]);
    
    const { assignments } = kMeans(embeddings, optimalK);
    let communities = buildCommunities(enrichedEvents, assignments, optimalK);

    const singletonCount = communities.filter((c) => c.size === 1).length;
    communities = communities.filter((c) => c.size > 1);

    const communityMap = new Map<number, number>();
    enrichedEvents.forEach((e, i) => {
      const node = graph.nodes.find((n) => n.id === e.id);
      if (node) communityMap.set(node.index, assignments[i]);
    });
    const modularity = computeModularity(graph, communityMap);
    const silhouette = communities.length >= 2 ? silhouetteCoefficient(embeddings, assignments) : 0;

    communities = communities.map(c => ({ ...c, modularity }));

    this.metrics = this.buildMetrics(start, communities.length);

    return {
      communities,
      modularity,
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
