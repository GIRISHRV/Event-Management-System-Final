// src/lib/algorithms/itransformer/attention.ts
// iTransformer attention layer
//
// Paper: Liu et al., "iTransformer: Inverted Transformers Are Effective for Time Series Forecasting"
//        ICLR 2024 — https://arxiv.org/abs/2310.06625

import { addVectors, scaleVector, dotProduct, normalizeVector, xavierInit } from "../shared/matrix";

// ─── Config ────────────────────────────────────────────────────────────────────

export interface iTransformerConfig {
  lookback: number;        // input window length in days   — default 14
  horizon: 7 | 14;        // forecast horizon in days      — default 7
  dModel: number;          // embedding dim per variable    — default 32
  numHeads: number;        // attention heads               — default 4
  numLayers: number;       // transformer encoder layers    — default 2
  ffnDim: number;          // feed-forward hidden dim       — default 64
  confidenceLevel: number; // for prediction intervals      — default 0.95
}

export const DEFAULT_ITRANSFORMER_CONFIG: iTransformerConfig = {
  lookback: 14,
  horizon: 7,
  dModel: 32,
  numHeads: 4,
  numLayers: 2,
  ffnDim: 64,
  confidenceLevel: 0.95,
};

// ─── Weights Interface ────────────────────────────────────────────────────────

export interface ITransformerWeights {
  W_proj: number[][][]; // [numVars][dModel][lookback] — Temporal projector
  W_q: number[][][][]; // [numLayers][numHeads][headDim][dModel]
  W_k: number[][][][]; // [numLayers][numHeads][headDim][dModel]
  W_v: number[][][][]; // [numLayers][numHeads][headDim][dModel]
  W_ff1: number[][][]; // [numLayers][ffnDim][dModel]
  W_ff2: number[][][]; // [numLayers][dModel][ffnDim]
  W_out: number[][][]; // [numVars][horizon][dModel] — Output projector
}

export function generateInitialWeights(
  numVars: number,
  config: iTransformerConfig
): ITransformerWeights {
  const { dModel, numHeads, numLayers, ffnDim, horizon, lookback } = config;
  const headDim = Math.floor(dModel / numHeads);

  const rand = () => (Math.random() * 2 - 1) * 0.1;
  const randMat = (r: number, c: number) => Array.from({ length: r }, () => Array.from({ length: c }, rand));

  return {
    W_proj: Array.from({ length: numVars }, () => xavierInit(dModel, lookback)),
    W_q: Array.from({ length: numLayers }, () => Array.from({ length: numHeads }, () => randMat(headDim, dModel))),
    W_k: Array.from({ length: numLayers }, () => Array.from({ length: numHeads }, () => randMat(headDim, dModel))),
    W_v: Array.from({ length: numLayers }, () => Array.from({ length: numHeads }, () => randMat(headDim, dModel))),
    W_ff1: Array.from({ length: numLayers }, () => xavierInit(ffnDim, dModel)),
    W_ff2: Array.from({ length: numLayers }, () => xavierInit(dModel, ffnDim)),
    W_out: Array.from({ length: numVars }, () => xavierInit(horizon, dModel)),
  };
}

// ─── Variable Embedding ────────────────────────────────────────────────────────

/**
 * Projects a raw time series embedding using a learned linear projection W_proj.
 * token = matVec(W_proj[varIdx], series)
 */
export function embedVariable(
  series: number[],
  varIdx: number,
  W_proj: number[][][]
): number[] {
  if (!W_proj[varIdx]) {
    // Fallback if weights are corrupted/missing
    return new Array(W_proj[0]?.length || 32).fill(0);
  }
  return matVec(W_proj[varIdx], series);
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function matVec(M: number[][], v: number[]): number[] {
  return M.map(row => row.reduce((s, w, i) => s + w * v[i], 0));
}

function softmax(v: number[]): number[] {
  const max = Math.max(...v);
  const exps = v.map(x => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map(x => x / (sum || 1));
}

function relu(x: number): number { return Math.max(0, x); }

// ─── Multi-Head Self-Attention (over variable tokens) ─────────────────────────

export function multiHeadAttention(
  tokens: number[][],
  numHeads: number,
  layerWeights: { W_q: number[][][]; W_k: number[][][]; W_v: number[][][] }
): number[][] {
  const dModel = tokens[0].length;
  const headDim = Math.floor(dModel / numHeads);
  const numVars = tokens.length;

  const headOutputs: number[][][] = [];

  for (let h = 0; h < numHeads; h++) {
    const Q = tokens.map(t => matVec(layerWeights.W_q[h], t));
    const K = tokens.map(t => matVec(layerWeights.W_k[h], t));
    const V = tokens.map(t => matVec(layerWeights.W_v[h], t));
    const scale = Math.sqrt(headDim);

    const headOut = tokens.map((_, i) => {
      const scores = K.map(k => dotProduct(Q[i], k) / scale);
      const weights = softmax(scores);
      let out = new Array(headDim).fill(0);
      for (let j = 0; j < numVars; j++) {
        out = addVectors(out, scaleVector(V[j], weights[j]));
      }
      return out;
    });

    headOutputs.push(headOut);
  }

  // Concatenate heads
  return tokens.map((_, i) => {
    const concat = new Array(dModel).fill(0);
    for (let h = 0; h < numHeads; h++) {
      for (let d = 0; d < headDim; d++) {
        concat[h * headDim + d] = headOutputs[h][i][d];
      }
    }
    return concat;
  });
}

// ─── Feed-Forward Network ─────────────────────────────────────────────────────

export function feedForward(
  token: number[],
  W_ff1: number[][],
  W_ff2: number[][]
): number[] {
  const h1 = matVec(W_ff1, token).map(relu);
  return matVec(W_ff2, h1);
}

// ─── Transformer Encoder Layer ────────────────────────────────────────────────

export function encoderLayer(
  tokens: number[][],
  config: iTransformerConfig,
  layerWeights: { W_q: number[][][]; W_k: number[][][]; W_v: number[][][]; W_ff1: number[][]; W_ff2: number[][] }
): number[][] {
  const dModel = tokens[0].length;

  // Self-attention + residual + layernorm
  const attnOut = multiHeadAttention(tokens, config.numHeads, layerWeights);
  const afterAttn = tokens.map((t, i) => {
    const res = addVectors(t, attnOut[i]);
    return normalizeVector(res).map(x => x * Math.sqrt(dModel));
  });

  // FFN + residual + layernorm per variable
  return afterAttn.map((t) => {
    const ffnOut = feedForward(t, layerWeights.W_ff1, layerWeights.W_ff2);
    const res = addVectors(t, ffnOut);
    return normalizeVector(res).map(x => x * Math.sqrt(dModel));
  });
}

// ─── Projection Head ──────────────────────────────────────────────────────────

/**
 * Projects each variable's final embedding → horizon-length forecast,
 * then weighted-sums across variables using learned importance weights.
 */
export function projectToForecast(
  tokens: number[][],
  horizon: number,
  varImportance: number[],
  W_out: number[][][]
): number[] {
  const varForecasts = tokens.map((token, varIdx) =>
    matVec(W_out[varIdx], token)
  );

  const forecast = new Array(horizon).fill(0);
  for (let varIdx = 0; varIdx < tokens.length; varIdx++) {
    for (let h = 0; h < horizon; h++) {
      forecast[h] += varImportance[varIdx] * varForecasts[varIdx][h];
    }
  }

  return forecast;
}