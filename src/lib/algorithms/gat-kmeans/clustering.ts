// src/lib/algorithms/gat-kmeans/clustering.ts
// K-Means clustering applied to GAT-learned event embeddings.
//
// Paper: GAT + K-Means for Event Community Detection, IEEE 2024
//        https://ieeexplore.ieee.org/document/10543468/
//
// Steps:
//   1. K-Means++ initialisation (avoids bad random seeds)
//   2. Assignment: each event → nearest centroid (cosine distance)
//   3. Update: recompute centroids as mean of assigned embeddings
//   4. Repeat until convergence or maxIter
//   5. Label each community by its most frequent tags

import { cosineSimilarity, addVectors, scaleVector } from "../shared/matrix";
import type { EventCommunity } from "../shared/types";
import type { EventForCommunity } from "./graph.ts";

// ─── K-Means++ Initialisation ─────────────────────────────────────────────────

function kMeansPlusPlus(embeddings: number[][], k: number): number[][] {
  const n = embeddings.length;
  if (n === 0) return [];

  const centroids: number[][] = [];

  // Pick first centroid randomly
  centroids.push([...embeddings[Math.floor(Math.random() * n)]]);

  for (let c = 1; c < k; c++) {
    // Compute D²(x) = min distance² to nearest existing centroid
    const distances = embeddings.map((emb) => {
      const minSim = Math.max(
        ...centroids.map((cent) => cosineSimilarity(emb, cent))
      );
      // Convert similarity to distance: d = 1 - sim
      return Math.pow(1 - minSim, 2);
    });

    // Sample next centroid proportional to D²
    const total = distances.reduce((a, b) => a + b, 0);
    if (total === 0) {
      centroids.push([...embeddings[Math.floor(Math.random() * n)]]);
      continue;
    }

    let r = Math.random() * total;
    for (let i = 0; i < n; i++) {
      r -= distances[i];
      if (r <= 0) {
        centroids.push([...embeddings[i]]);
        break;
      }
    }

    // Fallback in case of floating point issues
    if (centroids.length <= c) {
      centroids.push([...embeddings[Math.floor(Math.random() * n)]]);
    }
  }

  return centroids;
}

// ─── K-Means ──────────────────────────────────────────────────────────────────

export interface ClusterResult {
  assignments: number[];          // assignments[i] = cluster id for event i
  centroids: number[][];
  iterations: number;
  inertia: number;                // sum of squared distances to centroid
}

export function kMeans(
  embeddings: number[][],
  k: number,
  maxIter = 100,
  tolerance = 1e-4
): ClusterResult {
  const n = embeddings.length;
  const dim = embeddings[0]?.length ?? 1;

  // Clamp k to number of events
  const K = Math.min(k, n);
  if (K <= 1) {
    return {
      assignments: new Array(n).fill(0),
      centroids: [embeddings[0] ?? new Array(dim).fill(0)],
      iterations: 0,
      inertia: 0,
    };
  }

  // K-Means++ init
  let centroids = kMeansPlusPlus(embeddings, K);
  let assignments = new Array(n).fill(0);
  let iterations = 0;
  let inertia = 0;

  for (let iter = 0; iter < maxIter; iter++) {
    iterations = iter + 1;

    // Assignment step: each point → nearest centroid (cosine similarity)
    const newAssignments = embeddings.map((emb) => {
      let bestCluster = 0;
      let bestSim = -Infinity;
      for (let c = 0; c < K; c++) {
        const sim = cosineSimilarity(emb, centroids[c]);
        if (sim > bestSim) {
          bestSim = sim;
          bestCluster = c;
        }
      }
      return bestCluster;
    });

    // Update step: recompute centroids
    const newCentroids: number[][] = Array.from({ length: K }, () =>
      new Array(dim).fill(0)
    );
    const counts = new Array(K).fill(0);

    for (let i = 0; i < n; i++) {
      const c = newAssignments[i];
      newCentroids[c] = addVectors(newCentroids[c], embeddings[i]);
      counts[c]++;
    }

    for (let c = 0; c < K; c++) {
      if (counts[c] > 0) {
        newCentroids[c] = scaleVector(newCentroids[c], 1 / counts[c]);
      } else {
        // Empty cluster — reinitialise to random point
        newCentroids[c] = [...embeddings[Math.floor(Math.random() * n)]];
      }
    }

    // Check convergence: centroid shift
    const shift = centroids.reduce((sum, cent, c) => {
      const diff = cent.reduce(
        (s, x, d) => s + Math.pow(x - newCentroids[c][d], 2),
        0
      );
      return sum + Math.sqrt(diff);
    }, 0);

    assignments = newAssignments;
    centroids = newCentroids;

    if (shift < tolerance) break;
  }

  // Compute inertia (sum of 1 - cosine_sim for all points to their centroid)
  inertia = embeddings.reduce((sum, emb, i) => {
    const c = assignments[i];
    return sum + (1 - cosineSimilarity(emb, centroids[c]));
  }, 0);

  return { assignments, centroids, iterations, inertia };
}

// ─── Elbow Method: choose optimal K ──────────────────────────────────────────

/**
 * Runs K-Means for each K in kRange and picks the elbow point.
 * Simple elbow: largest second derivative of inertia curve.
 */
export function chooseOptimalK(
  embeddings: number[][],
  kRange: [number, number] = [3, 10]
): number {
  const n = embeddings.length;
  const [kMin, kMax] = [Math.min(kRange[0], n), Math.min(kRange[1], n)];

  if (kMax <= kMin) return kMin;

  const inertias: number[] = [];
  const ks: number[] = [];

  for (let k = kMin; k <= kMax; k++) {
    const result = kMeans(embeddings, k, 50); // fewer iters for speed
    inertias.push(result.inertia);
    ks.push(k);
  }

  // Find elbow: point of maximum curvature
  if (inertias.length <= 2) return ks[0];

  let bestK = ks[0];
  let maxCurvature = -Infinity;

  for (let i = 1; i < inertias.length - 1; i++) {
    // Second derivative approximation
    const curv = inertias[i - 1] - 2 * inertias[i] + inertias[i + 1];
    if (curv > maxCurvature) {
      maxCurvature = curv;
      bestK = ks[i];
    }
  }

  return bestK;
}

// ─── Community Labelling ──────────────────────────────────────────────────────

/**
 * Converts K-Means output into EventCommunity objects with labels.
 * Label = top 2 most frequent tags in the community.
 */
export function buildCommunities(
  events: EventForCommunity[],
  assignments: number[],
  k: number
): EventCommunity[] {
  const communities: EventCommunity[] = [];

  for (let c = 0; c < k; c++) {
    const memberIndices = assignments
      .map((a, i) => (a === c ? i : -1))
      .filter((i) => i !== -1);

    if (memberIndices.length === 0) continue;

    const memberEvents = memberIndices.map((i) => events[i]);
    const eventIds = memberEvents.map((e) => e.id);

    // Count tag frequencies
    const tagCounts = new Map<string, number>();
    for (const e of memberEvents) {
      for (const t of e.tags) {
        tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
      }
    }

    const topTags = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tag]) => tag);

    // Label: "Music & Photography" style
    const label =
      topTags.length > 0
        ? topTags
            .slice(0, 2)
            .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
            .join(" & ")
        : `Community ${c + 1}`;

    // Density = edges within community / possible edges
    const size = memberIndices.length;
    const maxEdges = (size * (size - 1)) / 2;
    const density = maxEdges > 0 ? Math.min(1, memberEvents.length / maxEdges) : 0;

    communities.push({
      communityId: c,
      label,
      eventIds,
      size,
      density,
      modularity: 0,          // filled by index.ts after computeModularity
      characteristics: topTags,
    });
  }

  return communities;
}
