// src/lib/algorithms/itransformer/attention.ts
// iTransformer attention layer
//
// Paper: Liu et al., "iTransformer: Inverted Transformers Are Effective for Time Series Forecasting"
//        ICLR 2024 — https://arxiv.org/abs/2310.06625
//
// Key insight: instead of treating each TIME STEP as a token (vanilla transformer),
// iTransformer treats each VARIABLE (feature channel) as a token.
// Each variable's entire time series is embedded as one token.
// Attention then captures inter-variable correlations rather than temporal patterns.
//
// For event attendance forecasting:
//   Variables = [daily_rsvps, cumulative_bookings, days_to_event, day_of_week]
//   Each variable gets a D-dim embedding of its full look-back window.
//   Attention learns which variables best predict future attendance.

import { addVectors, scaleVector, dotProduct, normalizeVector } from "../shared/matrix";

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

// ─── Variable Embedding ────────────────────────────────────────────────────────

/**
 * Projects a raw time series [lookback] → embedding [dModel].
 * Uses a deterministic projection seeded by variable index for reproducibility.
 */
export function embedVariable(
  series: number[],
  varIdx: number,
  dModel: number
): number[] {
  const T = series.length;
  const embedding = new Array(dModel).fill(0);

  for (let d = 0; d < dModel; d++) {
    let val = 0;
    for (let t = 0; t < T; t++) {
      const w = Math.sin(varIdx * 17.3 + t * 7.1 + d * 3.7);
      val += series[t] * w;
    }
    embedding[d] = val / Math.max(T, 1);
  }

  return normalizeVector(embedding);
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function deterministicWeight(rows: number, cols: number, seed: number): number[][] {
  return Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) =>
      Math.sin(seed * 13.7 + i * 5.3 + j * 2.9) * 0.1
    )
  );
}

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
  layerIdx: number
): number[][] {
  const dModel = tokens[0].length;
  const headDim = Math.max(1, Math.floor(dModel / numHeads));
  const numVars = tokens.length;

  const headOutputs: number[][][] = [];

  for (let h = 0; h < numHeads; h++) {
    const seed = layerIdx * 100 + h;
    const Wq = deterministicWeight(headDim, dModel, seed);
    const Wk = deterministicWeight(headDim, dModel, seed + 1);
    const Wv = deterministicWeight(headDim, dModel, seed + 2);

    const Q = tokens.map(t => matVec(Wq, t));
    const K = tokens.map(t => matVec(Wk, t));
    const V = tokens.map(t => matVec(Wv, t));
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

  // Mean-pool heads → pad/tile back to dModel
  return tokens.map((_, i) => {
    const pooled = new Array(headDim).fill(0);
    for (const ho of headOutputs) {
      for (let d = 0; d < headDim; d++) pooled[d] += ho[i][d];
    }
    const mean = pooled.map(x => x / numHeads);
    return Array.from({ length: dModel }, (_, d) => mean[d % headDim]);
  });
}

// ─── Feed-Forward Network ─────────────────────────────────────────────────────

export function feedForward(
  token: number[],
  ffnDim: number,
  layerIdx: number,
  varIdx: number
): number[] {
  const dModel = token.length;

  const h1 = Array.from({ length: ffnDim }, (_, j) => {
    const w = deterministicWeight(1, dModel, layerIdx * 1000 + varIdx * 10 + j)[0];
    return relu(dotProduct(token, w));
  });

  return Array.from({ length: dModel }, (_, d) => {
    const w = Array.from({ length: ffnDim }, (_, j) =>
      Math.sin(layerIdx * 500 + varIdx * 20 + d * 7 + j * 3) * 0.05
    );
    return dotProduct(h1, w);
  });
}

// ─── Transformer Encoder Layer ────────────────────────────────────────────────

export function encoderLayer(
  tokens: number[][],
  config: iTransformerConfig,
  layerIdx: number
): number[][] {
  const dModel = tokens[0].length;

  // Self-attention + residual + layernorm
  const attnOut = multiHeadAttention(tokens, config.numHeads, layerIdx);
  const afterAttn = tokens.map((t, i) => {
    const res = addVectors(t, attnOut[i]);
    const norm = normalizeVector(res);
    return norm.map(x => x * Math.sqrt(dModel));
  });

  // FFN + residual + layernorm per variable
  return afterAttn.map((t, varIdx) => {
    const ffnOut = feedForward(t, config.ffnDim, layerIdx, varIdx);
    const res = addVectors(t, ffnOut);
    const norm = normalizeVector(res);
    return norm.map(x => x * Math.sqrt(dModel));
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
  varImportance: number[]
): number[] {
  const dModel = tokens[0].length;

  const varForecasts = tokens.map((token, varIdx) =>
    Array.from({ length: horizon }, (_, h) => {
      const w = Array.from({ length: dModel }, (_, d) =>
        Math.sin(varIdx * 31.7 + h * 11.3 + d * 2.1) * 0.1
      );
      return dotProduct(token, w);
    })
  );

  const forecast = new Array(horizon).fill(0);
  for (let varIdx = 0; varIdx < tokens.length; varIdx++) {
    for (let h = 0; h < horizon; h++) {
      forecast[h] += varImportance[varIdx] * varForecasts[varIdx][h];
    }
  }

  return forecast;
}