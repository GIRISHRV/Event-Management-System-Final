// src/lib/algorithms/gnn-cf/cross-attention.ts
// GNN message passing + cross-domain attention transfer
//
// Paper: "Cross-Domain Recommendation via Preference Propagation GraphNet"
//        IEEE Transactions, 2024 — https://ieeexplore.ieee.org/document/10452478
//
// Architecture overview:
//   1. GNN propagation on Domain A (user-event) — 2 layers, LightGCN-style
//   2. GNN propagation on Domain B (user-vendor) — 2 layers, LightGCN-style
//   3. Cross-domain attention gate:
//        α = softmax(Q_A · K_B^T / √d)
//        h_cross = α · V_B  + (1 - α) · h_A
//      where Q_A = Domain A user embedding, K_B/V_B = Domain B user embedding
//   4. Category-tag bridge scoring:
//        score(event) = cosine_sim(category_profile, event_tag_profile)
//        weighted by cross-domain attention gate α

import {
  normalizedAdjacency,
  addVectors,
  scaleVector,
  cosineSimilarity,
  normalizeVector,
  xavierInit,
} from "../shared/matrix";
import type { Graph } from "../shared/graph";
import type { VendorSignal, CandidateEventFeatures } from "./graph-builder";

// ─── Config ────────────────────────────────────────────────────────────────────

export interface GNNCFConfig {
  embeddingDim: number;     // default 32
  gnnLayers: number;        // default 2 (shallow for cold-start)
  attentionHeads: number;   // default 1 (single-head for efficiency)
  popularityWeight: number; // [0,1] fallback blend weight, default 0.15
}

export const DEFAULT_GNN_CF_CONFIG: GNNCFConfig = {
  embeddingDim: 32,
  gnnLayers: 2,
  attentionHeads: 1,
  popularityWeight: 0.15,
};

// ─── Embedding State ───────────────────────────────────────────────────────────

export interface EmbeddingState {
  userEmbeddings: Map<string, number[]>;
  itemEmbeddings: Map<string, number[]>;
}

// ─── GNN Propagation ──────────────────────────────────────────────────────────

/**
 * Initialises random embeddings for all nodes in a graph.
 * Uses Xavier uniform to keep activations stable.
 */
export function initEmbeddingsForGraph(
  graph: Graph,
  dim: number
): EmbeddingState {
  const nodes = graph.nodes;

  // Split nodes by type
  const userNodes = nodes.filter(n => n.type === "user");
  const itemNodes = nodes.filter(n => n.type === "event" || n.type === "vendor");

  // Xavier init: rows = total nodes, cols = dim
  const totalNodes = nodes.length;
  const initMatrix = xavierInit(totalNodes, dim);

  const userEmbeddings = new Map<string, number[]>();
  const itemEmbeddings = new Map<string, number[]>();

  for (const node of userNodes) {
    userEmbeddings.set(node.id, initMatrix[node.index]);
  }
  for (const node of itemNodes) {
    itemEmbeddings.set(node.id, initMatrix[node.index]);
  }

  return { userEmbeddings, itemEmbeddings };
}

/**
 * LightGCN-style GNN propagation — no non-linearity, no self-connection.
 * After L layers, each node embedding is the mean of its L-hop neighbourhood.
 *
 *   E^(l+1) = D^(-1/2) A D^(-1/2) E^(l)
 *   E_final = mean(E^(0), ..., E^(L))
 *
 * Seeded with real interaction weights as edge values — cold-start users
 * will propagate through their sparse Domain B signal.
 */
export function gnnPropagate(
  graph: Graph,
  state: EmbeddingState,
  layers: number
): EmbeddingState {
  const allNodes = graph.nodes;
  const totalNodes = allNodes.length;
  const dim = (state.userEmbeddings.values().next().value as number[] | undefined)?.length ?? 32;

  // Build a flat embedding array indexed by graph node index
  const current: number[][] = Array.from({ length: totalNodes }, (_, i) => {
    const node = allNodes[i];
    if (node.type === "user") {
      return state.userEmbeddings.get(node.id) ?? new Array(dim).fill(0);
    }
    return state.itemEmbeddings.get(node.id) ?? new Array(dim).fill(0);
  });

  // Precompute normalised adjacency for stable propagation
  const normAdj = normalizedAdjacency(graph.adjacency, totalNodes);

  // Collect all layer outputs for mean pooling (LightGCN trick)
  const layerOutputs: number[][][] = [current.map(v => [...v])];

  let prev = current;

  for (let l = 0; l < layers; l++) {
    const next: number[][] = Array.from({ length: totalNodes }, () =>
      new Array(dim).fill(0)
    );

    for (let i = 0; i < totalNodes; i++) {
      const neighbours = normAdj.getNonZeroCols(i);
      if (neighbours.length === 0) {
        // Isolated node — keep current embedding
        next[i] = [...prev[i]];
        continue;
      }
      // Aggregate: next[i] = Σ_j normAdj[i,j] * prev[j]
      let agg = new Array(dim).fill(0);
      for (const { col: j, value: w } of neighbours) {
        agg = addVectors(agg, scaleVector(prev[j], w));
      }
      next[i] = agg;
    }

    layerOutputs.push(next.map(v => [...v]));
    prev = next;
  }

  // Mean-pool across all layers (E^(0) + ... + E^(L)) / (L+1)
  const finalEmbeddings: number[][] = Array.from(
    { length: totalNodes },
    (_, i) => {
      const sum = layerOutputs[0][i].map(() => 0);
      for (const layerOut of layerOutputs) {
        for (let d = 0; d < dim; d++) sum[d] += layerOut[i][d];
      }
      return sum.map(x => x / layerOutputs.length);
    }
  );

  // Write back into EmbeddingState
  const updatedUserEmbeddings = new Map<string, number[]>();
  const updatedItemEmbeddings = new Map<string, number[]>();

  for (let i = 0; i < totalNodes; i++) {
    const node = allNodes[i];
    if (node.type === "user") {
      updatedUserEmbeddings.set(node.id, finalEmbeddings[i]);
    } else {
      updatedItemEmbeddings.set(node.id, finalEmbeddings[i]);
    }
  }

  return {
    userEmbeddings: updatedUserEmbeddings,
    itemEmbeddings: updatedItemEmbeddings,
  };
}

// ─── Cross-Domain Attention Gate ──────────────────────────────────────────────

/**
 * Computes the cross-domain attention weight α ∈ [0, 1].
 * α = sigmoid( dot(h_A, h_B) / sqrt(d) )
 *
 * High α  → Domain B is informative; blend heavily from Domain B
 * Low α   → Domain B is noisy or absent; fall back to Domain A / popularity
 *
 * If Domain A embedding is absent (pure cold start), α defaults to 1.0.
 */
export function crossDomainAttentionGate(
  userEmbeddingA: number[] | null,
  userEmbeddingB: number[] | null,
  dim: number
): number {
  if (!userEmbeddingB) return 0;            // no Domain B signal → ignore
  if (!userEmbeddingA) return 1.0;          // pure cold start → full Domain B

  const normA = normalizeVector(userEmbeddingA);
  const normB = normalizeVector(userEmbeddingB);

  const dot = normA.reduce((s, x, i) => s + x * normB[i], 0);
  const scaled = dot / Math.sqrt(dim);      // scale factor

  // Sigmoid gate: σ(x) = 1 / (1 + e^(-x))
  return 1 / (1 + Math.exp(-scaled));
}

/**
 * Blends Domain A and Domain B user embeddings using the attention gate.
 *
 *   h_cross = α · h_B + (1 − α) · h_A
 *
 * Returns the Domain B embedding scaled by α when Domain A is absent,
 * or zero vector when both are absent (fallback to popularity).
 */
export function blendEmbeddings(
  userEmbeddingA: number[] | null,
  userEmbeddingB: number[] | null,
  alpha: number,
  dim: number
): number[] {
  const zeros = new Array(dim).fill(0);

  if (!userEmbeddingB && !userEmbeddingA) return zeros;
  if (!userEmbeddingB) return userEmbeddingA!;
  if (!userEmbeddingA) return scaleVector(userEmbeddingB, alpha);

  const partB = scaleVector(userEmbeddingB, alpha);
  const partA = scaleVector(userEmbeddingA, 1 - alpha);
  return addVectors(partA, partB);
}

// ─── Category–Tag Bridge Scoring ──────────────────────────────────────────────

/**
 * Builds a category interest profile vector for the user from Domain B signals.
 *
 * Returns a Map<category_token, cumulative_weight> representing which
 * vendor category tokens the user has expressed interest in.
 *
 * e.g. { "photography": 1.8, "music": 0.8, "catering": 0.4 }
 */
export function buildCategoryProfile(
  vendorSignals: VendorSignal[]
): Map<string, number> {
  const profile = new Map<string, number>();

  for (const signal of vendorSignals) {
    for (const cat of signal.categories) {
      profile.set(cat, (profile.get(cat) ?? 0) + signal.weight);
    }
  }

  // L1-normalise so total sums to 1
  const total = [...profile.values()].reduce((s, v) => s + v, 0);
  if (total > 0) {
    for (const [cat, val] of profile.entries()) {
      profile.set(cat, val / total);
    }
  }

  return profile;
}

/**
 * Computes the category-to-tag affinity score for a single candidate event.
 *
 * score = Σ_t  (category_profile[t] * indicator(t ∈ event.tags))
 *       + partial_match_bonus (substring or token overlap)
 *
 * Range: [0, 1].
 */
export function categoryTagAffinity(
  categoryProfile: Map<string, number>,
  event: CandidateEventFeatures
): number {
  if (categoryProfile.size === 0 || event.tags.length === 0) return 0;

  const eventTagSet = new Set(event.tags);
  let score = 0;

  for (const [cat, weight] of categoryProfile.entries()) {
    // Exact match: category token appears in event tags
    if (eventTagSet.has(cat)) {
      score += weight;
      continue;
    }

    // Partial match: event tag contains category token or vice versa
    // e.g. "photography" matches "event-photography", "live music" matches "music"
    for (const tag of event.tags) {
      if (tag.includes(cat) || cat.includes(tag)) {
        score += weight * 0.6;   // partial match gets 60% credit
        break;
      }
    }
  }

  return Math.min(1, score);   // cap at 1
}

// ─── Final Scoring ─────────────────────────────────────────────────────────────

export interface ScoredEvent {
  eventId: string;
  score: number;
  scoreBreakdown: {
    embeddingScore: number;     // cosine sim of cross-domain user emb vs event emb
    categoryScore: number;      // category-tag bridge affinity
    popularityScore: number;    // normalised attendee_count fallback
    attentionGate: number;      // α value used
  };
}

/**
 * Scores all candidate events for a cold-start user using:
 *
 *   final_score = α * category_score
 *               + (1−α) * embedding_score
 *               + λ * popularity_score
 *
 * where λ = popularityWeight (small blending constant to avoid zero scores).
 */
export function scoreEventsCrossDomain(
  crossUserEmbedding: number[],
  alpha: number,
  categoryProfile: Map<string, number>,
  candidateEvents: CandidateEventFeatures[],
  domainAEventEmbeddings: Map<string, number[]>,
  config: GNNCFConfig
): ScoredEvent[] {
  if (candidateEvents.length === 0) return [];

  // Normalise popularity for the blending term
  const maxAttendees = Math.max(...candidateEvents.map(e => e.attendee_count), 1);

  const crossNorm = normalizeVector(crossUserEmbedding);

  const scored: ScoredEvent[] = candidateEvents.map(event => {
    // 1. Embedding score: cosine similarity between user cross-embedding and
    //    the event's Domain A embedding (or random init if unseen)
    const eventEmb = domainAEventEmbeddings.get(event.id);
    const embeddingScore = eventEmb
      ? cosineSimilarity(crossNorm, normalizeVector(eventEmb))
      : 0;

    // 2. Category-tag bridge score
    const categoryScore = categoryTagAffinity(categoryProfile, event);

    // 3. Popularity score (log-scaled)
    const popularityScore =
      event.attendee_count > 0
        ? Math.log1p(event.attendee_count) / Math.log1p(maxAttendees)
        : 0;

    // 4. Blend: weighted combination
    const { popularityWeight } = config;
    const score =
      alpha * categoryScore +
      (1 - alpha) * Math.max(0, (embeddingScore + 1) / 2) +   // shift [-1,1] → [0,1]
      popularityWeight * popularityScore;

    return {
      eventId: event.id,
      score: Math.max(0, Math.min(1, score)),
      scoreBreakdown: {
        embeddingScore: Math.max(0, (embeddingScore + 1) / 2),
        categoryScore,
        popularityScore,
        attentionGate: alpha,
      },
    };
  });

  return scored.sort((a, b) => b.score - a.score);
}
