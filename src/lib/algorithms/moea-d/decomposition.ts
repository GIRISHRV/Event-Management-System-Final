// src/lib/algorithms/moea-d/decomposition.ts
// Weight vector generation and Tchebycheff scalarisation for MOEA/D
//
// Paper: MOEA/D-DRA-NEF, IEEE 2025 — https://ieeexplore.ieee.org/document/10862940/
//
// MOEA/D decomposes a multi-objective problem into N scalar subproblems,
// each defined by a weight vector λ = (λ_1, λ_2, λ_3) where Σλ_i = 1.
//
// Three objectives for vendor budget optimisation:
//   f1 = cost          (minimise — lower is better)
//   f2 = quality       (maximise — negate so we minimise)
//   f3 = rating        (maximise — negate so we minimise)
//
// Tchebycheff scalarisation:
//   g(x | λ, z*) = max_i { λ_i * |f_i(x) - z*_i| }
// where z* is the ideal (best) point found so far.

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface WeightVector {
  lambda: [number, number, number];  // [cost_w, quality_w, rating_w]
  neighbourhoodIndices: number[];    // indices of T nearest weight vectors
}

export interface ObjectiveVector {
  cost: number;        // total cost (raw ₹)
  quality: number;     // mean quality score [0–100]
  rating: number;      // mean rating [0–5]
}

export interface IdealPoint {
  minCost: number;
  maxQuality: number;
  maxRating: number;
}

// ─── Uniform Weight Vector Generation ─────────────────────────────────────────

/**
 * Generates N uniformly spread weight vectors on the 3D simplex.
 * Uses the Das & Dennis systematic approach: enumerate all (i,j,k) with
 * i+j+k = H (divisions), then normalise.
 */
export function generateWeightVectors(H: number): WeightVector[] {
  const raw: Array<[number, number, number]> = [];

  for (let i = 0; i <= H; i++) {
    for (let j = 0; j <= H - i; j++) {
      const k = H - i - j;
      raw.push([i / H, j / H, k / H]);
    }
  }

  // Build neighbourhood: T nearest vectors by Euclidean distance
  const T = Math.min(5, raw.length - 1);

  return raw.map((lambda) => {
    const distances = raw.map((other, otherIdx) => ({
      idx: otherIdx,
      dist: Math.sqrt(
        (lambda[0] - other[0]) ** 2 +
        (lambda[1] - other[1]) ** 2 +
        (lambda[2] - other[2]) ** 2
      ),
    }));

    distances.sort((a, b) => a.dist - b.dist);
    const neighbourhoodIndices = distances
      .slice(1, T + 1)   // exclude self
      .map(d => d.idx);

    return { lambda, neighbourhoodIndices };
  });
}

// ─── Tchebycheff Scalarisation ─────────────────────────────────────────────────

/**
 * Tchebycheff scalarisation — converts multi-objective vector to scalar.
 * Lower is better. Objectives are normalised to [0,1] before scoring.
 *
 * g(x | λ, z*) = max_i { λ_i * |f_i(x) - z*_i| }
 */
export function tchebycheff(
  obj: ObjectiveVector,
  lambda: [number, number, number],
  ideal: IdealPoint,
  nadir: IdealPoint   // worst-case values for normalisation
): number {
  // Normalise each objective to [0,1] — lower = better after normalisation
  const costRange = Math.max(nadir.minCost - ideal.minCost, 1);
  const qualRange = Math.max(ideal.maxQuality - nadir.maxQuality, 1);
  const ratingRange = Math.max(ideal.maxRating - nadir.maxRating, 1);

  const f1 = (obj.cost - ideal.minCost) / costRange;                    // cost: lower better
  const f2 = (ideal.maxQuality - obj.quality) / qualRange;              // quality: higher better → negate
  const f3 = (ideal.maxRating - obj.rating) / ratingRange;              // rating: higher better → negate

  return Math.max(
    lambda[0] * Math.abs(f1),
    lambda[1] * Math.abs(f2),
    lambda[2] * Math.abs(f3)
  );
}

// ─── Ideal + Nadir Point Update ────────────────────────────────────────────────

export function updateIdealPoint(
  current: IdealPoint,
  obj: ObjectiveVector
): IdealPoint {
  return {
    minCost:      Math.min(current.minCost, obj.cost),
    maxQuality:   Math.max(current.maxQuality, obj.quality),
    maxRating:    Math.max(current.maxRating, obj.rating),
  };
}

export function updateNadirPoint(
  current: IdealPoint,
  obj: ObjectiveVector
): IdealPoint {
  return {
    minCost:      Math.max(current.minCost, obj.cost),
    maxQuality:   Math.min(current.maxQuality, obj.quality),
    maxRating:    Math.min(current.maxRating, obj.rating),
  };
}

export function initIdealPoint(): IdealPoint {
  return { minCost: Infinity, maxQuality: -Infinity, maxRating: -Infinity };
}

export function initNadirPoint(): IdealPoint {
  return { minCost: -Infinity, maxQuality: Infinity, maxRating: Infinity };
}
