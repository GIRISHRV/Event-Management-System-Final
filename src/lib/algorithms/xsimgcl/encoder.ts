// src/lib/algorithms/xsimgcl/encoder.ts
// LightGCN-style graph convolution + XSimGCL uniform noise augmentation
//
// Paper: Yu et al., "XSimGCL: Towards Extremely Simple Graph Contrastive
// Learning for Recommendation" — IEEE TKDE Vol.36 No.2, 2024
// DOI: 10.1109/TKDE.2023.3288135

import { type Graph } from "../shared/graph";
import {
  xavierInit,
  normalizeVector,
  uniformNoise,
  normalizedAdjacency,
  addVectors,
  scaleVector,
} from "../shared/matrix";

export interface EncoderConfig {
  embeddingDim: number;    // default 64
  numLayers: number;       // default 2 (LightGCN uses 2–4 layers)
  noiseAlpha: number;      // uniform noise range, default 0.1
}

export const DEFAULT_ENCODER_CONFIG: EncoderConfig = {
  embeddingDim: 64,
  numLayers: 2,
  noiseAlpha: 0.1,
};

export interface EncoderState {
  userEmbeddings: Map<string, number[]>;   // userId → embedding vector
  eventEmbeddings: Map<string, number[]>;  // eventId → embedding vector
  config: EncoderConfig;
}

// Initialise embeddings randomly using Xavier uniform
export function initEmbeddings(
  userIds: string[],
  eventIds: string[],
  config: EncoderConfig = DEFAULT_ENCODER_CONFIG
): EncoderState {
  const totalNodes = userIds.length + eventIds.length;
  const rawMatrix = xavierInit(totalNodes, config.embeddingDim);

  const userEmbeddings = new Map<string, number[]>();
  const eventEmbeddings = new Map<string, number[]>();

  userIds.forEach((id, i) => userEmbeddings.set(id, rawMatrix[i]));
  eventIds.forEach((id, i) => eventEmbeddings.set(id, rawMatrix[userIds.length + i]));

  return { userEmbeddings, eventEmbeddings, config };
}

// LightGCN graph convolution propagation
// Formula: H^(l+1) = D^(-1/2) A D^(-1/2) H^(l)
// Final embedding = mean of all layer outputs (including layer 0)
export function lightgcnPropagate(
  graph: Graph,
  state: EncoderState
): EncoderState {
  const { config } = state;
  const numNodes = graph.nodes.length;

  // Build initial embedding matrix from state
  const H0: number[][] = new Array(numNodes).fill(null).map(() =>
    new Array(config.embeddingDim).fill(0)
  );

  for (const node of graph.nodes) {
    const emb = node.type === "user"
      ? state.userEmbeddings.get(node.id)
      : state.eventEmbeddings.get(node.id);
    if (emb) H0[node.index] = [...emb];
  }

  // Normalised adjacency: Â = D^(-1/2) A D^(-1/2)
  const normAdj = normalizedAdjacency(graph.adjacency, numNodes);

  // Layer-wise propagation
  const layerOutputs: number[][][] = [H0];
  let H = H0;

  for (let layer = 0; layer < config.numLayers; layer++) {
    const H_next: number[][] = new Array(numNodes).fill(null).map(() =>
      new Array(config.embeddingDim).fill(0)
    );

    // H_next[i] = Σ_j Â[i,j] * H[j]
    for (let i = 0; i < numNodes; i++) {
      for (const { col: j, value: aij } of normAdj.getNonZeroCols(i)) {
        for (let d = 0; d < config.embeddingDim; d++) {
          H_next[i][d] += aij * H[j][d];
        }
      }
    }
    layerOutputs.push(H_next);
    H = H_next;
  }

  // Final embedding = mean across all layers (including layer 0)
  const numLayers = layerOutputs.length;
  const finalEmbeddings: number[][] = new Array(numNodes).fill(null).map((_, i) => {
    let sum = new Array(config.embeddingDim).fill(0);
    for (const layerH of layerOutputs) {
      sum = addVectors(sum, layerH[i]);
    }
    return scaleVector(sum, 1 / numLayers);
  });

  // Write back to state — normalise each embedding
  const newUserEmbeddings = new Map<string, number[]>(state.userEmbeddings);
  const newEventEmbeddings = new Map<string, number[]>(state.eventEmbeddings);

  for (const node of graph.nodes) {
    const emb = normalizeVector(finalEmbeddings[node.index]);
    if (node.type === "user") newUserEmbeddings.set(node.id, emb);
    else newEventEmbeddings.set(node.id, emb);
  }

  return {
    userEmbeddings: newUserEmbeddings,
    eventEmbeddings: newEventEmbeddings,
    config,
  };
}

// XSimGCL augmentation: add uniform noise ε ~ Uniform(-α, α) to embeddings
// Creates two views for contrastive learning
export function augmentEmbeddings(
  state: EncoderState
): { view1: EncoderState; view2: EncoderState } {
  const { noiseAlpha } = state.config;

  const augmentMap = (original: Map<string, number[]>): Map<string, number[]> => {
    const augmented = new Map<string, number[]>();
    for (const [id, emb] of original.entries()) {
      augmented.set(id, normalizeVector(uniformNoise(emb, noiseAlpha)));
    }
    return augmented;
  };

  const view1: EncoderState = {
    userEmbeddings: augmentMap(state.userEmbeddings),
    eventEmbeddings: augmentMap(state.eventEmbeddings),
    config: state.config,
  };

  const view2: EncoderState = {
    userEmbeddings: augmentMap(state.userEmbeddings),
    eventEmbeddings: augmentMap(state.eventEmbeddings),
    config: state.config,
  };

  return { view1, view2 };
}

// InfoNCE contrastive loss for a batch of users
// L = -Σ_u log( exp(z_u · z_u' / τ) / Σ_v exp(z_u · z_v' / τ) )
// τ = temperature (default 0.2)
export function infoNCELoss(
  view1Embeddings: number[][],   // [batchSize × embeddingDim]
  view2Embeddings: number[][],   // [batchSize × embeddingDim]
  temperature: number = 0.2
): number {
  const n = view1Embeddings.length;
  if (n === 0) return 0;

  let totalLoss = 0;

  for (let i = 0; i < n; i++) {
    const z_i = view1Embeddings[i];
    const z_i_prime = view2Embeddings[i];

    // Positive pair score
    const posScore = dotProductNorm(z_i, z_i_prime) / temperature;

    // Negative pairs: all other view2 embeddings
    let denominator = 0;
    for (let j = 0; j < n; j++) {
      denominator += Math.exp(dotProductNorm(z_i, view2Embeddings[j]) / temperature);
    }

    totalLoss += -posScore + Math.log(denominator);
  }

  return totalLoss / n;
}

function dotProductNorm(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

// ─── BPR Training Loop ────────────────────────────────────────────────────────
// Bayesian Personalised Ranking for learning user-item embeddings.
// For each user, samples a positive (interacted) and negative (random) item,
// then pushes them apart via the BPR loss: -log(σ(pos - neg))

export interface BPRInteraction {
  userId: string;
  eventId: string;
  score: number;
}

export interface BPRResult {
  state: EncoderState;
  lossPerEpoch: number[];
  totalEpochs: number;
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x))));
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function trainBPR(
  state: EncoderState,
  interactions: BPRInteraction[],
  epochs: number = 15,
  lr: number = 0.005,
  reg: number = 0.001
): BPRResult {
  if (interactions.length === 0) {
    return { state, lossPerEpoch: [], totalEpochs: 0 };
  }

  // Build per-user positive sets for negative sampling
  const userPositives = new Map<string, Set<string>>();
  for (const { userId, eventId } of interactions) {
    if (!userPositives.has(userId)) userPositives.set(userId, new Set());
    userPositives.get(userId)!.add(eventId);
  }

  const allEventIds = [...state.eventEmbeddings.keys()];
  const lossPerEpoch: number[] = [];

  // Clone embeddings for in-place updates
  const userEmbs = new Map<string, number[]>();
  for (const [id, emb] of state.userEmbeddings) userEmbs.set(id, [...emb]);
  const itemEmbs = new Map<string, number[]>();
  for (const [id, emb] of state.eventEmbeddings) itemEmbs.set(id, [...emb]);

  for (let epoch = 0; epoch < epochs; epoch++) {
    let epochLoss = 0;
    // Shuffle interactions
    const shuffled = [...interactions].sort(() => Math.random() - 0.5);

    for (const { userId, eventId: posId } of shuffled) {
      const uEmb = userEmbs.get(userId);
      const posEmb = itemEmbs.get(posId);
      if (!uEmb || !posEmb) continue;

      // Sample negative item the user hasn't interacted with
      const positiveSet = userPositives.get(userId)!;
      let negId: string | null = null;
      for (let attempt = 0; attempt < 10; attempt++) {
        const candidate = allEventIds[Math.floor(Math.random() * allEventIds.length)];
        if (!positiveSet.has(candidate)) {
          negId = candidate;
          break;
        }
      }
      if (!negId) continue;

      const negEmb = itemEmbs.get(negId);
      if (!negEmb) continue;

      // Compute scores
      const posScore = dot(uEmb, posEmb);
      const negScore = dot(uEmb, negEmb);
      const diff = posScore - negScore;

      // BPR loss: -log(sigmoid(diff))
      const sigDiff = sigmoid(diff);
      epochLoss += -Math.log(Math.max(sigDiff, 1e-10));

      // Gradient coefficient
      const coeff = 1 - sigDiff;

      // Gradient update
      const dim = uEmb.length;
      for (let d = 0; d < dim; d++) {
        const uGrad = coeff * (posEmb[d] - negEmb[d]) - reg * uEmb[d];
        const posGrad = coeff * uEmb[d] - reg * posEmb[d];
        const negGrad = -coeff * uEmb[d] - reg * negEmb[d];

        uEmb[d] += lr * uGrad;
        posEmb[d] += lr * posGrad;
        negEmb[d] += lr * negGrad;
      }
    }

    lossPerEpoch.push(epochLoss / shuffled.length);
  }

  // Normalise embeddings after training
  for (const [id, emb] of userEmbs) userEmbs.set(id, normalizeVector(emb));
  for (const [id, emb] of itemEmbs) itemEmbs.set(id, normalizeVector(emb));

  return {
    state: {
      userEmbeddings: userEmbs,
      eventEmbeddings: itemEmbs,
      config: state.config,
    },
    lossPerEpoch,
    totalEpochs: epochs,
  };
}

// Score all candidate events for a user
// Returns scores sorted descending
export function scoreEvents(
  userEmbedding: number[],
  eventEmbeddings: Map<string, number[]>,
  candidateEventIds: string[],
  excludeIds: Set<string>
): Array<{ eventId: string; score: number }> {
  const scores: Array<{ eventId: string; score: number }> = [];

  for (const eventId of candidateEventIds) {
    if (excludeIds.has(eventId)) continue;
    const eventEmb = eventEmbeddings.get(eventId);
    if (!eventEmb) continue;

    // Cosine similarity (embeddings are already L2-normalised after propagation)
    let s = 0;
    for (let i = 0; i < userEmbedding.length; i++) {
      s += userEmbedding[i] * eventEmb[i];
    }
    scores.push({ eventId, score: s });
  }

  return scores.sort((a, b) => b.score - a.score);
}
