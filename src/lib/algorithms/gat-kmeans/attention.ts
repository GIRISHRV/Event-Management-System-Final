// src/lib/algorithms/gat-kmeans/attention.ts
// Graph Attention Network (GAT) layer for event community detection
//
// Paper: GAT + K-Means for Event Community Detection, IEEE 2024
//        https://ieeexplore.ieee.org/document/10543468/
//
// GAT computes attention-weighted neighbourhood aggregation:
//
//   e_ij  = LeakyReLU( a^T · [W·h_i ‖ W·h_j] )        (raw attention)
//   α_ij  = softmax_j( e_ij )                           (normalised)
//   h'_i  = σ( Σ_j  α_ij · W · h_j )                  (new embedding)
//
// Multi-head: run K independent heads and concatenate (or mean-pool).
// Here we use mean-pool (simpler, same quality for inference-only use).

import {
  addVectors,
  scaleVector,
  normalizeVector,
  xavierInit,
} from "../shared/matrix";
import type { Graph } from "../shared/graph";

// ─── Config ────────────────────────────────────────────────────────────────────

export interface GATConfig {
  inputDim: number;     // feature dimension (number of unique tags, or embedding dim)
  hiddenDim: number;    // output embedding dim per head  — default 16
  numHeads: number;     // number of attention heads     — default 4
  numLayers: number;    // GAT layers                    — default 2
  leakySlope: number;   // LeakyReLU negative slope      — default 0.2
  dropout: number;      // not applied at inference      — default 0.6
}

export const DEFAULT_GAT_CONFIG: GATConfig = {
  inputDim: 64,
  hiddenDim: 16,
  numHeads: 4,
  numLayers: 2,
  leakySlope: 0.2,
  dropout: 0.6,
};

// ─── Weights Interface ────────────────────────────────────────────────────────

export interface GATHeadWeights {
  W: number[][]; // [hiddenDim × inputDim]
  a: number[];   // [2 * hiddenDim]
}

export interface GATLayerWeights {
  heads: GATHeadWeights[];
}

export interface GATWeights {
  layers: GATLayerWeights[];
}

export function generateInitialGatWeights(
  config: GATConfig
): GATWeights {
  const { inputDim, hiddenDim, numHeads, numLayers } = config;
  
  const layers: GATLayerWeights[] = [];
  for (let l = 0; l < numLayers; l++) {
    const inDim = l === 0 ? inputDim : hiddenDim;
    const heads = Array.from({ length: numHeads }, () => ({
      W: xavierInit(hiddenDim, inDim),
      a: Array.from({ length: 2 * hiddenDim }, () => (Math.random() * 2 - 1) * 0.1),
    }));
    layers.push({ heads });
  }

  return { layers };
}

// ─── Single GAT Head ──────────────────────────────────────────────────────────

function leakyRelu(x: number, slope: number): number {
  return x >= 0 ? x : slope * x;
}

function matVec(M: number[][], v: number[]): number[] {
  return M.map((row) => row.reduce((s, w, i) => s + w * v[i], 0));
}

/**
 * Runs a single GAT head over all nodes using provided weights.
 */
function runGatHead(
  graph: Graph,
  nodeFeatures: number[][],
  weights: GATHeadWeights,
  leakySlope: number
): number[][] {
  const n = graph.nodes.length;
  const hiddenDim = weights.W.length;

  // 1. Linear transform: Wh_i for each node
  const Wh: number[][] = nodeFeatures.map((h) => matVec(weights.W, h));

  // 2. Compute attention coefficients + softmax per node
  const newEmbeddings: number[][] = Array.from({ length: n }, () =>
    new Array(hiddenDim).fill(0)
  );

  for (let i = 0; i < n; i++) {
    const neighbours = graph.adjacency.getNonZeroCols(i);

    if (neighbours.length === 0) {
      newEmbeddings[i] = [...Wh[i]];
      continue;
    }

    // Include self-loop
    const allNeighbours = [{ col: i, value: 1.0 }, ...neighbours];

    // Raw attention scores e_ij = LeakyReLU(a^T [Wh_i || Wh_j])
    const rawScores = allNeighbours.map(({ col: j }) => {
      const concat = [...Wh[i], ...Wh[j]];
      const dot = weights.a.reduce((s, w, k) => s + w * concat[k], 0);
      return leakyRelu(dot, leakySlope);
    });

    const maxScore = Math.max(...rawScores);
    const expScores = rawScores.map((s) => Math.exp(s - maxScore));
    const sumExp = expScores.reduce((a, b) => a + b, 0);
    const alphas = expScores.map((e) => e / (sumExp || 1));

    let agg = new Array(hiddenDim).fill(0);
    allNeighbours.forEach(({ col: j }, idx) => {
      agg = addVectors(agg, scaleVector(Wh[j], alphas[idx]));
    });

    // ELU activation
    newEmbeddings[i] = agg.map((x) => (x >= 0 ? x : Math.exp(x) - 1));
  }

  return newEmbeddings;
}

// ─── Multi-Head GAT Layer ─────────────────────────────────────────────────────

function runGatLayer(
  graph: Graph,
  nodeFeatures: number[][],
  layerWeights: GATLayerWeights,
  leakySlope: number
): number[][] {
  const headOutputs = layerWeights.heads.map((head) =>
    runGatHead(graph, nodeFeatures, head, leakySlope)
  );

  const n = nodeFeatures.length;
  const hiddenDim = headOutputs[0][0].length;

  return Array.from({ length: n }, (_, i) => {
    const sum = new Array(hiddenDim).fill(0);
    for (const headOut of headOutputs) {
      for (let d = 0; d < hiddenDim; d++) sum[d] += headOut[i][d];
    }
    return sum.map((x) => x / headOutputs.length);
  });
}

// ─── Initial Feature Extraction ───────────────────────────────────────────────

/**
 * Builds initial node feature vectors from event tags (bag-of-words).
 * Vocabulary = all unique tags across all events.
 * Feature vector[i] = 1 if tag_i present, else 0 — then L2-normalised.
 */
export function buildNodeFeatures(
  events: Array<{ id: string; tags: string[] }>
): { features: number[][]; vocab: string[]; dim: number } {
  // Build vocabulary
  const vocabSet = new Set<string>();
  for (const e of events) {
    for (const t of e.tags) vocabSet.add(t);
  }

  // If vocab is empty, use a constant 1D feature
  if (vocabSet.size === 0) {
    return {
      features: events.map(() => [1]),
      vocab: ["__default__"],
      dim: 1,
    };
  }

  const vocab = [...vocabSet].sort();
  const vocabIndex = new Map(vocab.map((t, i) => [t, i]));
  const dim = vocab.length;

  const features = events.map((e) => {
    const vec = new Array(dim).fill(0);
    for (const t of e.tags) {
      const idx = vocabIndex.get(t);
      if (idx !== undefined) vec[idx] = 1;
    }
    return normalizeVector(vec);
  });

  return { features, vocab, dim };
}

// ─── Full GAT Encoder ─────────────────────────────────────────────────────────

/**
 * Runs L GAT layers on the event similarity graph.
 * Returns final node embeddings [numNodes × hiddenDim].
 */
export function runGAT(
  graph: Graph,
  events: Array<{ id: string; tags: string[] }>,
  config: GATConfig,
  weights?: GATWeights
): Map<string, number[]> {
  // Build initial features
  const { features, dim } = buildNodeFeatures(events);

  // Pad or truncate features to match inputDim
  const inputDim = Math.min(dim, config.inputDim);
  const paddedFeatures = features.map((f) => {
    const padded = new Array(config.inputDim).fill(0);
    for (let i = 0; i < inputDim; i++) padded[i] = f[i] ?? 0;
    return padded;
  });

  const activeWeights = weights ?? generateInitialGatWeights(config);

  // Forward pass
  let currentFeatures = paddedFeatures;
  for (let l = 0; l < config.numLayers; l++) {
    const layerOut = runGatLayer(graph, currentFeatures, activeWeights.layers[l], config.leakySlope);
    
    // Skip residual if dimensions don't match (e.g. first layer usually has different inputDim)
    if (currentFeatures[0]?.length === layerOut[0]?.length) {
      currentFeatures = currentFeatures.map((f, i) =>
        normalizeVector(addVectors(f, layerOut[i]))
      );
    } else {
      currentFeatures = layerOut;
    }
  }

  // Return as map: eventId → embedding
  const embeddings = new Map<string, number[]>();
  events.forEach((e, i) => {
    embeddings.set(e.id, currentFeatures[i]);
  });

  return embeddings;
}
