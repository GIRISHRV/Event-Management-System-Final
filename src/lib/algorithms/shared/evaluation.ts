// src/lib/algorithms/shared/evaluation.ts
// Evaluation metrics for all 5 algorithms
// These get stored in algorithm_results for the IEEE paper experiments

// ─── Recommendation Metrics (XSimGCL + GNN-CF) ────────────────────────────────

// NDCG@K — Normalised Discounted Cumulative Gain
// Measures ranking quality — higher is better, max 1.0
// Formula: DCG@K / IDCG@K
export function ndcgAtK(
  recommended: string[],    // ordered list of recommended event IDs
  relevant: string[],       // ground truth relevant event IDs
  k: number
): number {
  const topK = recommended.slice(0, k);
  const relevantSet = new Set(relevant);

  // DCG: score items at position i with discount 1/log2(i+2)
  let dcg = 0;
  for (let i = 0; i < topK.length; i++) {
    if (relevantSet.has(topK[i])) {
      dcg += 1 / Math.log2(i + 2);
    }
  }

  // IDCG: ideal DCG — all relevant items at top positions
  const idealHits = Math.min(relevant.length, k);
  let idcg = 0;
  for (let i = 0; i < idealHits; i++) {
    idcg += 1 / Math.log2(i + 2);
  }

  return idcg === 0 ? 0 : dcg / idcg;
}

// Precision@K — fraction of recommended items that are relevant
export function precisionAtK(
  recommended: string[],
  relevant: string[],
  k: number
): number {
  const topK = recommended.slice(0, k);
  const relevantSet = new Set(relevant);
  const hits = topK.filter(id => relevantSet.has(id)).length;
  return k === 0 ? 0 : hits / k;
}

// Recall@K — fraction of relevant items that were recommended
export function recallAtK(
  recommended: string[],
  relevant: string[],
  k: number
): number {
  if (relevant.length === 0) return 0;
  const topK = recommended.slice(0, k);
  const relevantSet = new Set(relevant);
  const hits = topK.filter(id => relevantSet.has(id)).length;
  return hits / relevant.length;
}

// Hit Rate@K — fraction of users who received at least one relevant recommendation
export function hitRateAtK(
  recommended: string[],
  relevant: string[],
  k: number
): number {
  const topK = recommended.slice(0, k);
  const relevantSet = new Set(relevant);
  return topK.some(id => relevantSet.has(id)) ? 1 : 0;
}

// MRR@K — Mean Reciprocal Rank
// Measures where the first relevant item appears in the list.
// Formula: 1 / rank of first relevant item
export function mrrAtK(
  recommended: string[],
  relevant: string[],
  k: number
): number {
  const topK = recommended.slice(0, k);
  const relevantSet = new Set(relevant);
  for (let i = 0; i < topK.length; i++) {
    if (relevantSet.has(topK[i])) {
      return 1 / (i + 1);
    }
  }
  return 0;
}

// Coverage — fraction of all events that appear in at least one recommendation list
export function catalogCoverage(
  allRecommendationLists: string[][],
  totalEvents: number
): number {
  if (totalEvents === 0) return 0;
  const recommended = new Set(allRecommendationLists.flat());
  return recommended.size / totalEvents;
}

// Intra-list diversity — average pairwise dissimilarity within a recommendation list
// Higher = more diverse recommendations
export function intraListDiversity(
  recommended: string[],
  similarityFn: (a: string, b: string) => number
): number {
  const n = recommended.length;
  if (n <= 1) return 0;
  let totalDissimilarity = 0;
  let pairs = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      totalDissimilarity += 1 - similarityFn(recommended[i], recommended[j]);
      pairs++;
    }
  }
  return pairs === 0 ? 0 : totalDissimilarity / pairs;
}

// ─── Forecasting Metrics (iTransformer) ───────────────────────────────────────

// MAE — Mean Absolute Error
export function mae(actual: number[], predicted: number[]): number {
  if (actual.length !== predicted.length) throw new Error("Length mismatch");
  if (actual.length === 0) return 0;
  const sum = actual.reduce((s, a, i) => s + Math.abs(a - predicted[i]), 0);
  return sum / actual.length;
}

// RMSE — Root Mean Squared Error
export function rmse(actual: number[], predicted: number[]): number {
  if (actual.length !== predicted.length) throw new Error("Length mismatch");
  if (actual.length === 0) return 0;
  const sum = actual.reduce((s, a, i) => s + (a - predicted[i]) ** 2, 0);
  return Math.sqrt(sum / actual.length);
}

// MAPE — Mean Absolute Percentage Error
// Returns value in [0, 1] range (multiply by 100 for percentage)
export function mape(actual: number[], predicted: number[]): number {
  if (actual.length !== predicted.length) throw new Error("Length mismatch");
  if (actual.length === 0) return 0;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < actual.length; i++) {
    if (actual[i] !== 0) {
      sum += Math.abs((actual[i] - predicted[i]) / actual[i]);
      count++;
    }
  }
  return count === 0 ? 0 : sum / count;
}

// R² — Coefficient of Determination
export function rSquared(actual: number[], predicted: number[]): number {
  if (actual.length !== predicted.length) throw new Error("Length mismatch");
  if (actual.length === 0) return 0;
  const mean = actual.reduce((s, x) => s + x, 0) / actual.length;
  const ssTot = actual.reduce((s, x) => s + (x - mean) ** 2, 0);
  const ssRes = actual.reduce((s, x, i) => s + (x - predicted[i]) ** 2, 0);
  return ssTot === 0 ? 1 : 1 - ssRes / ssTot;
}

// ─── Budget Optimizer Metrics (MOEA/D-DRA-NEF) ────────────────────────────────

// Hypervolume Indicator — measures the volume of objective space dominated by
// the Pareto front. Higher = better Pareto front quality.
// Reference point should be the worst possible values for each objective.
// For 2 objectives (cost, quality after negation):
export function hypervolume2D(
  paretoFront: Array<[number, number]>,  // [cost, -quality] pairs
  referencePoint: [number, number]       // worst case values
): number {
  if (paretoFront.length === 0) return 0;

  // Sort by first objective ascending
  const sorted = [...paretoFront].sort((a, b) => a[0] - b[0]);

  let hv = 0;
  let prevX = referencePoint[0];

  // Sweep line algorithm
  for (let i = sorted.length - 1; i >= 0; i--) {
    const [x, y] = sorted[i];
    const width = prevX - x;
    const height = referencePoint[1] - y;
    if (width > 0 && height > 0) {
      hv += width * height;
    }
    prevX = x;
  }

  return hv;
}

// Budget utilization rate
export function budgetUtilization(totalCost: number, budget: number): number {
  return budget === 0 ? 0 : Math.min(totalCost / budget, 1);
}

// Improvement over greedy baseline (percentage)
export function improvementOverBaseline(
  optimizedQuality: number,
  greedyQuality: number
): number {
  if (greedyQuality === 0) return 0;
  return ((optimizedQuality - greedyQuality) / greedyQuality) * 100;
}

// ─── Community Detection Metrics (GAT + K-Means) ──────────────────────────────

// Silhouette coefficient — measures how well each point fits its cluster
// Returns mean silhouette across all points, range [-1, 1], higher is better
export function silhouetteCoefficient(
  embeddings: number[][],
  labels: number[]
): number {
  const n = embeddings.length;
  if (n <= 1) return 0;

  const scores: number[] = [];

  for (let i = 0; i < n; i++) {
    const ci = labels[i];

    // a(i): mean distance to points in same cluster
    const sameCluster = embeddings
      .filter((_, j) => j !== i && labels[j] === ci)
      .map(e => euclideanDistance(embeddings[i], e));

    const a = sameCluster.length === 0 ? 0
      : sameCluster.reduce((s, x) => s + x, 0) / sameCluster.length;

    // b(i): mean distance to points in nearest other cluster
    const otherClusters = new Set(labels.filter((l, j) => j !== i && l !== ci));
    let b = Infinity;
    for (const otherCluster of otherClusters) {
      const otherPoints = embeddings
        .filter((_, j) => labels[j] === otherCluster)
        .map(e => euclideanDistance(embeddings[i], e));
      const meanDist = otherPoints.reduce((s, x) => s + x, 0) / otherPoints.length;
      if (meanDist < b) b = meanDist;
    }
    if (b === Infinity) b = 0;

    const s = Math.max(a, b) === 0 ? 0 : (b - a) / Math.max(a, b);
    scores.push(s);
  }

  return scores.reduce((s, x) => s + x, 0) / scores.length;
}

function euclideanDistance(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0));
}

// ─── General Utilities ─────────────────────────────────────────────────────────

// Softmax over a vector
export function softmax(v: number[]): number[] {
  const maxVal = Math.max(...v);
  const exps = v.map(x => Math.exp(x - maxVal));  // subtract max for numerical stability
  const sum = exps.reduce((s, x) => s + x, 0);
  return exps.map(x => x / sum);
}

// Top-K indices of an array (descending order)
export function topKIndices(arr: number[], k: number): number[] {
  return arr
    .map((val, idx) => ({ val, idx }))
    .sort((a, b) => b.val - a.val)
    .slice(0, k)
    .map(x => x.idx);
}

// Clamp a value to [min, max]
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
