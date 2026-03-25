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
  selection: number[];           // indices of selected vendors (one per category group)
  objectives: ObjectiveVector;
  feasible: boolean;             // within budget
}

// ─── Objective Evaluation ─────────────────────────────────────────────────────

/**
 * Evaluates the three objectives for a given vendor selection.
 * selection[i] is the index of the vendor chosen from the i-th category group.
 */
export function evaluate(
  selection: number[],
  categoryGroups: VendorCandidate[][],
  budget: number
): { objectives: ObjectiveVector; feasible: boolean } {
  const selected: VendorCandidate[] = [];
  
  for (let i = 0; i < categoryGroups.length; i++) {
    const idx = selection[i];
    if (idx >= 0 && idx < categoryGroups[i].length) {
      selected.push(categoryGroups[i][idx]);
    }
  }

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
 * Generates a random feasible solution by picking one random vendor per category.
 * If over budget, it greedily swaps to cheaper vendors in the same category.
 */
export function randomFeasibleSolution(
  categoryGroups: VendorCandidate[][],
  budget: number
): Solution {
  // 1. Initial random selection (one per category)
  const selection = categoryGroups.map(group => 
    Math.floor(Math.random() * group.length)
  );

  let { objectives, feasible } = evaluate(selection, categoryGroups, budget);

  // 2. Greedy Repair if over budget
  if (!feasible) {
    // Rank categories by the cost of their current selection
    const sortedCats = categoryGroups
      .map((_, i) => i)
      .sort((a, b) => {
        const costA = categoryGroups[a][selection[a]].baseCost;
        const costB = categoryGroups[b][selection[b]].baseCost;
        return costB - costA; // Most expensive categories first
      });

    for (const catIdx of sortedCats) {
      if (feasible) break;
      
      // Find cheapest vendor in this category
      const group = categoryGroups[catIdx];
      let minIdx = 0;
      for (let j = 1; j < group.length; j++) {
        if (group[j].baseCost < group[minIdx].baseCost) minIdx = j;
      }
      
      selection[catIdx] = minIdx;
      const result = evaluate(selection, categoryGroups, budget);
      objectives = result.objectives;
      feasible = result.feasible;
    }
  }

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
