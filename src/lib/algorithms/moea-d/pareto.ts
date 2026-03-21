// src/lib/algorithms/moea-d/pareto.ts
// Solution encoding, objective evaluation, and Pareto front management
//
// A "solution" = a binary selection vector over the vendor candidate list.
// solution[i] = true  → include vendor i in the bundle
// solution[i] = false → exclude vendor i

import { shannonEntropy } from "../shared/matrix";
import type { VendorCandidate } from "../shared/types";
import type { ObjectiveVector, IdealPoint } from "./decomposition";

// ─── Solution ─────────────────────────────────────────────────────────────────

export interface Solution {
  selection: boolean[];          // which vendors are selected
  objectives: ObjectiveVector;
  feasible: boolean;             // within budget
}

// ─── Objective Evaluation ─────────────────────────────────────────────────────

/**
 * Evaluates the three objectives for a given vendor selection.
 */
export function evaluate(
  selection: boolean[],
  vendors: VendorCandidate[],
  budget: number
): { objectives: ObjectiveVector; feasible: boolean } {
  const selected = vendors.filter((_, i) => selection[i]);

  const cost = selected.reduce((s, v) => s + v.baseCost, 0);
  const feasible = cost <= budget;

  const quality =
    selected.length === 0
      ? 0
      : selected.reduce((s, v) => s + v.qualityScore, 0) / selected.length;

  const categories = selected.map(v => v.category);
  const diversity = shannonEntropy(categories);

  return {
    objectives: { cost, quality, diversity },
    feasible,
  };
}

// ─── Random Solution Generation ───────────────────────────────────────────────

/**
 * Generates a random feasible solution by greedily adding vendors
 * until the budget is exhausted.
 */
export function randomFeasibleSolution(
  vendors: VendorCandidate[],
  budget: number
): Solution {
  // Shuffle vendor indices
  const indices = vendors.map((_, i) => i).sort(() => Math.random() - 0.5);

  const selection = new Array(vendors.length).fill(false);
  let remaining = budget;

  for (const i of indices) {
    if (vendors[i].baseCost <= remaining) {
      selection[i] = true;
      remaining -= vendors[i].baseCost;
    }
  }

  const { objectives, feasible } = evaluate(selection, vendors, budget);
  return { selection, objectives, feasible };
}

// ─── Pareto Dominance ─────────────────────────────────────────────────────────

/**
 * Returns true if solution A dominates solution B.
 * A dominates B if A is no worse on all objectives and strictly better on at least one.
 * (All objectives are "lower is better" after cost/quality/diversity negation.)
 */
export function dominates(a: ObjectiveVector, b: ObjectiveVector): boolean {
  // For our objectives: cost ↓, quality ↑ (so -quality), diversity ↑ (so -diversity)
  const aCost = a.cost;
  const bCost = b.cost;
  const aQual = -a.quality;
  const bQual = -b.quality;
  const aDiv = -a.diversity;
  const bDiv = -b.diversity;

  const noWorse =
    aCost <= bCost && aQual <= bQual && aDiv <= bDiv;
  const strictlyBetter =
    aCost < bCost || aQual < bQual || aDiv < bDiv;

  return noWorse && strictlyBetter;
}

/**
 * Filters a list of solutions to the non-dominated (Pareto) front.
 */
export function paretoFront(solutions: Solution[]): Solution[] {
  return solutions.filter(sol => {
    if (!sol.feasible) return false;
    return !solutions.some(
      other =>
        other.feasible &&
        other !== sol &&
        dominates(other.objectives, sol.objectives)
    );
  });
}

// ─── Ideal + Nadir from Population ────────────────────────────────────────────

export function computeIdealFromPopulation(
  solutions: Solution[],
  initial: IdealPoint
): IdealPoint {
  let ideal = { ...initial };
  for (const s of solutions) {
    if (!s.feasible) continue;
    ideal = {
      minCost:      Math.min(ideal.minCost, s.objectives.cost),
      maxQuality:   Math.max(ideal.maxQuality, s.objectives.quality),
      maxDiversity: Math.max(ideal.maxDiversity, s.objectives.diversity),
    };
  }
  return ideal;
}

export function computeNadirFromPopulation(
  solutions: Solution[],
  initial: IdealPoint
): IdealPoint {
  let nadir = { ...initial };
  for (const s of solutions) {
    if (!s.feasible) continue;
    nadir = {
      minCost:      Math.max(nadir.minCost, s.objectives.cost),
      maxQuality:   Math.min(nadir.maxQuality, s.objectives.quality),
      maxDiversity: Math.min(nadir.maxDiversity, s.objectives.diversity),
    };
  }
  return nadir;
}
