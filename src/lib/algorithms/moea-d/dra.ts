// src/lib/algorithms/moea-d/dra.ts
// DRA (Dynamic Resource Allocation) + NEF (Neighbourhood Exploration with Fitness)
//
// Paper: MOEA/D-DRA-NEF, IEEE 2025 — https://ieeexplore.ieee.org/document/10862940/
//
// DRA: tracks improvement history per subproblem, allocates more compute
//      budget to subproblems that improved recently (utility-based selection).
//
// NEF: neighbourhood-aware crossover that explores the T nearest weight
//      vector subproblems when generating offspring.

import type { VendorCandidate } from "../shared/types";
import type { WeightVector } from "./decomposition";
import { tchebycheff } from "./decomposition";
import {
  evaluate,
  randomFeasibleSolution,
  type Solution,
} from "./pareto";

// ─── DRA Utility Tracking ──────────────────────────────────────────────────────

export interface SubproblemUtility {
  utility: number;         // DRA utility score [0,1]
  oldFitness: number;      // fitness at last utility update
  currentFitness: number;
  improvementCount: number;
}

/**
 * Initialises utility scores — all start at 1.0 (equally prioritised).
 */
export function initUtilities(n: number): SubproblemUtility[] {
  return Array.from({ length: n }, () => ({
    utility: 1.0,
    oldFitness: Infinity,
    currentFitness: Infinity,
    improvementCount: 0,
  }));
}

/**
 * Selects which subproblems to update this generation using DRA utility.
 * Returns indices of selected subproblems (top-K by utility + random remainder).
 */
export function selectActiveSubproblems(
  utilities: SubproblemUtility[],
  budget: number   // how many subproblems to activate this generation
): number[] {
  const n = utilities.length;
  const k = Math.min(budget, n);

  // Rank by utility descending, take top-k
  return utilities
    .map((u, i) => ({ i, utility: u.utility }))
    .sort((a, b) => b.utility - a.utility)
    .slice(0, k)
    .map(x => x.i);
}

/**
 * Updates utility scores after a generation.
 * Utility = delta_improvement / (delta_improvement + 1) — bounded in [0,1].
 * Subproblems that didn't improve have utility decay toward 0.
 */
export function updateUtilities(
  utilities: SubproblemUtility[],
  activeIndices: number[]
): SubproblemUtility[] {
  const updated = [...utilities];

  for (const i of activeIndices) {
    const u = updated[i];
    const delta = Math.max(0, u.oldFitness - u.currentFitness);

    if (delta > 0.001) {
      updated[i] = {
        ...u,
        utility: Math.max(0.01, delta / (delta + 1)),
        oldFitness: u.currentFitness,
        improvementCount: u.improvementCount + 1,
      };
    } else {
      // Decay utility if no improvement
      updated[i] = {
        ...u,
        utility: Math.max(0.01, u.utility * 0.9),
        oldFitness: u.currentFitness,
      };
    }
  }

  return updated;
}

// ─── NEF Crossover ─────────────────────────────────────────────────────────────

/**
 * NEF neighbourhood crossover:
 * Given parent solution at subproblem i and a random neighbour solution,
 * produces an offspring by uniform crossover of the selection vectors.
 * Then applies a small mutation (bit-flip) to escape local optima.
 */
export function nefCrossover(
  parent: Solution,
  neighbour: Solution,
  vendors: VendorCandidate[],
  budget: number,
  mutationRate: number = 0.1
): Solution {
  const n = vendors.length;
  const childSelection = new Array(n).fill(false);

  // Uniform crossover
  for (let i = 0; i < n; i++) {
    childSelection[i] = Math.random() < 0.5
      ? parent.selection[i]
      : neighbour.selection[i];
  }

  // Mutation: flip each bit with probability mutationRate
  for (let i = 0; i < n; i++) {
    if (Math.random() < mutationRate) {
      childSelection[i] = !childSelection[i];
    }
  }

  // Repair: if over budget, remove cheapest-to-remove selected vendors
  let cost = vendors.reduce((s, v, i) => childSelection[i] ? s + v.baseCost : s, 0);

  if (cost > budget) {
    // Sort selected vendors by cost descending — remove most expensive first
    const selected = vendors
      .map((v, i) => ({ v, i }))
      .filter(x => childSelection[x.i])
      .sort((a, b) => b.v.baseCost - a.v.baseCost);

    for (const { i, v } of selected) {
      if (cost <= budget) break;
      childSelection[i] = false;
      cost -= v.baseCost;
    }
  }

  const { objectives, feasible } = evaluate(childSelection, vendors, budget);
  return { selection: childSelection, objectives, feasible };
}

// ─── Main MOEA/D-DRA-NEF Loop ─────────────────────────────────────────────────

export interface MOEADConfig {
  populationSize: number;  // N subproblems — default = weight vectors count
  maxGenerations: number;  // default 80
  neighbourhoodSize: number; // T — default 5
  draActiveFraction: number; // fraction of subproblems active per gen — default 0.3
  mutationRate: number;    // NEF mutation — default 0.1
  weightDivisions: number; // H for weight vector generation — default 6
}

export const DEFAULT_MOEAD_CONFIG: MOEADConfig = {
  populationSize: 28,      // C(6+2,2) = 28 weight vectors for H=6
  maxGenerations: 80,
  neighbourhoodSize: 5,
  draActiveFraction: 0.3,
  mutationRate: 0.1,
  weightDivisions: 6,
};

export function runMOEAD(
  vendors: VendorCandidate[],
  budget: number,
  weightVectors: WeightVector[],
  config: MOEADConfig
): Solution[] {
  const N = weightVectors.length;
  if (N === 0 || vendors.length === 0) return [];

  // Initialise population — one solution per subproblem
  const population: Solution[] = Array.from({ length: N }, () =>
    randomFeasibleSolution(vendors, budget)
  );

  // Compute initial ideal + nadir
  let ideal = {
    minCost: Math.min(...population.filter(s => s.feasible).map(s => s.objectives.cost), Infinity),
    maxQuality: Math.max(...population.filter(s => s.feasible).map(s => s.objectives.quality), 0),
    maxDiversity: Math.max(...population.filter(s => s.feasible).map(s => s.objectives.diversity), 0),
  };
  const nadir = {
    minCost: Math.max(...population.filter(s => s.feasible).map(s => s.objectives.cost), 0),
    maxQuality: Math.min(...population.filter(s => s.feasible).map(s => s.objectives.quality), 100),
    maxDiversity: Math.min(...population.filter(s => s.feasible).map(s => s.objectives.diversity), 10),
  };

  // Initialise DRA utilities
  let utilities = initUtilities(N);

  // Compute initial fitness per subproblem
  const fitness = population.map((sol, i) =>
    sol.feasible
      ? tchebycheff(sol.objectives, weightVectors[i].lambda, ideal, nadir)
      : Infinity
  );
  utilities = utilities.map((u, i) => ({ ...u, currentFitness: fitness[i], oldFitness: fitness[i] }));

  const activeBudget = Math.max(1, Math.round(N * config.draActiveFraction));

  // ── Main loop ───────────────────────────────────────────────────────────────
  for (let gen = 0; gen < config.maxGenerations; gen++) {
    const activeIndices = selectActiveSubproblems(utilities, activeBudget);

    for (const i of activeIndices) {
      const wv = weightVectors[i];

      // Pick a random neighbour from T-neighbourhood
      const neighbourIdx =
        wv.neighbourhoodIndices[
          Math.floor(Math.random() * wv.neighbourhoodIndices.length)
        ] ?? i;

      // NEF crossover
      const offspring = nefCrossover(
        population[i],
        population[neighbourIdx],
        vendors,
        budget,
        config.mutationRate
      );

      if (!offspring.feasible) continue;

      // Update ideal point
      ideal = {
        minCost:      Math.min(ideal.minCost, offspring.objectives.cost),
        maxQuality:   Math.max(ideal.maxQuality, offspring.objectives.quality),
        maxDiversity: Math.max(ideal.maxDiversity, offspring.objectives.diversity),
      };

      // Update neighbouring subproblems if offspring is better
      for (const j of [i, ...wv.neighbourhoodIndices]) {
        if (j >= N) continue;
        const currentScore = tchebycheff(population[j].objectives, weightVectors[j].lambda, ideal, nadir);
        const offspringScore = tchebycheff(offspring.objectives, weightVectors[j].lambda, ideal, nadir);

        if (offspringScore < currentScore) {
          population[j] = offspring;
          utilities[j] = {
            ...utilities[j],
            currentFitness: offspringScore,
          };
        }
      }
    }

    utilities = updateUtilities(utilities, activeIndices);
  }

  return population;
}
