// src/lib/algorithms/moea-d/index.ts
// MOEA/D-DRA-NEF: Multi-Objective Evolutionary Algorithm based on Decomposition
// with Dynamic Resource Allocation and Neighbourhood Exploration with Fitness
//
// Paper: IEEE 2025 — https://ieeexplore.ieee.org/document/10862940/
//
// Three objectives:
//   1. Minimise total vendor cost           (stay within budget)
//   2. Maximise mean quality score          (best vendors)
//   3. Maximise category diversity          (Shannon entropy — don't hire 5 photographers)

import type {
  AlgorithmBase,
  AlgorithmMetrics,
  BudgetOptimizerInput,
  BudgetOptimizerOutput,
  VendorBundle,
  VendorCandidate,
  ValidationResult,
} from "../shared/types";

import { hypervolume2D } from "../shared/evaluation";
import { generateWeightVectors } from "./decomposition";
import { paretoFront } from "./pareto";
import { runMOEAD, DEFAULT_MOEAD_CONFIG, type MOEADConfig } from "./dra";

export class MOEAD
  implements AlgorithmBase<BudgetOptimizerInput, BudgetOptimizerOutput>
{
  readonly name = "MOEAD";
  readonly version = "1.0.0";

  private config: MOEADConfig;

  private metrics: AlgorithmMetrics = {
    executionTimeMs: 0,
    inputSize: 0,
    outputSize: 0,
    version: this.version,
    timestamp: new Date(),
  };

  constructor(config: Partial<MOEADConfig> = {}) {
    this.config = { ...DEFAULT_MOEAD_CONFIG, ...config };
  }

  // ─── Validation ──────────────────────────────────────────────────────────────

  validate(input: BudgetOptimizerInput): ValidationResult {
    const errors: string[] = [];
    if (!input.eventId) errors.push("eventId is required");
    if (!input.budget || input.budget <= 0) errors.push("budget must be > 0");
    if (!input.vendors || input.vendors.length === 0) errors.push("vendors array must not be empty");
    return { isValid: errors.length === 0, errors };
  }

  // ─── Execute ─────────────────────────────────────────────────────────────────

  async execute(input: BudgetOptimizerInput): Promise<BudgetOptimizerOutput> {
    const start = Date.now();

    const validation = this.validate(input);
    if (!validation.isValid) {
      throw new Error(`[MOEAD] Invalid input: ${validation.errors.join(", ")}`);
    }

    const { budget, vendors } = input;
    this.metrics.inputSize = vendors.length;

    // ── Step 1: Filter vendors that fit within budget at all ──────────────────
    const affordable = vendors.filter(v => v.baseCost <= budget);

    if (affordable.length === 0) {
      this.metrics = this.buildMetrics(start, 0);
      return { bundles: [], paretoSize: 0, metrics: this.metrics };
    }

    // ── Step 1b: Group by category ──────
    const groupsMap = new Map<string, VendorCandidate[]>();
    for (const v of affordable) {
      // If the user specified required categories, completely ignore all other categories!
      if (input.requiredCategories && input.requiredCategories.length > 0 && !input.requiredCategories.includes(v.category.toLowerCase())) {
        continue;
      }
      if (!groupsMap.has(v.category)) groupsMap.set(v.category, []);
      groupsMap.get(v.category)!.push(v);
    }
    const categoryGroups = Array.from(groupsMap.values());

    // ── Step 2: Generate weight vectors (H=6 → 28 subproblems) ───────────────
    const weightVectors = generateWeightVectors(this.config.weightDivisions);

    // ── Step 3: Run MOEA/D-DRA-NEF ───────────────────────────────────────────
    const population = runMOEAD(
      categoryGroups,
      budget,
      weightVectors,
      this.config
    );

    // ── Step 4: Extract Pareto front ──────────────────────────────────────────
    const front = paretoFront(population);

    if (front.length === 0) {
      this.metrics = this.buildMetrics(start, 0);
      return { bundles: [], paretoSize: 0, metrics: this.metrics };
    }

    // ── Step 5: Select 3–5 diverse bundles from the Pareto front ─────────────
    const selected = this.selectDiverseBundles(front, categoryGroups, 5);

    // ── Step 6: Label and build VendorBundle objects ──────────────────────────
    const bundles = this.labelBundles(selected, categoryGroups, budget);

    // ── Step 6: Compute Hypervolume indicator ───────────────────────────────
    const hvPoints: Array<[number, number]> = front.map(s => [
      s.objectives.cost,
      -s.objectives.quality, // negate for minimisation
    ]);
    const refPoint: [number, number] = [budget * 1.1, 0]; // 110% budget, zero quality
    const hv = hypervolume2D(hvPoints, refPoint);

    this.metrics = this.buildMetrics(start, bundles.length);

    return {
      bundles,
      paretoSize: front.length,
      hypervolume: parseFloat(hv.toFixed(4)),
      metrics: this.metrics,
    };
  }

  // ─── Bundle Selection ─────────────────────────────────────────────────────────

  /**
   * Picks up to `maxBundles` solutions from the Pareto front that are
   * maximally spread across cost/quality/diversity axes.
   */
  private selectDiverseBundles(
    front: ReturnType<typeof paretoFront>,
    categoryGroups: VendorCandidate[][],
    maxBundles: number
  ) {
    if (front.length <= maxBundles) return front;

    // 1. Normalise objectives for fair Euclidean distance calculation
    const costs = front.map(f => f.objectives.cost);
    const qualities = front.map(f => f.objectives.quality);
    const ratings = front.map(f => f.objectives.rating);

    const minC = Math.min(...costs), maxC = Math.max(...costs);
    const minQ = Math.min(...qualities), maxQ = Math.max(...qualities);
    const minR = Math.min(...ratings), maxR = Math.max(...ratings);

    const rangeC = Math.max(maxC - minC, 1);
    const rangeQ = Math.max(maxQ - minQ, 1);
    const rangeR = Math.max(maxR - minR, 1);

    const normalised = front.map(f => ({
      ...f,
      norm: [
        (f.objectives.cost - minC) / rangeC,
        (f.objectives.quality - minQ) / rangeQ,
        (f.objectives.rating - minR) / rangeR,
      ],
    }));

    const picked: typeof normalised = [];

    // Seed 1: The absolute cheapest solution (guarantees a strong "Budget Pick")
    let bestCostIdx = 0;
    for (let i = 1; i < normalised.length; i++) {
      if (normalised[i].objectives.cost < normalised[bestCostIdx].objectives.cost) bestCostIdx = i;
    }
    picked.push(normalised.splice(bestCostIdx, 1)[0]);

    // Seed 2: The absolute highest quality solution (guarantees a strong "Premium")
    if (normalised.length > 0) {
      let bestQualIdx = 0;
      for (let i = 1; i < normalised.length; i++) {
        if (normalised[i].objectives.quality > normalised[bestQualIdx].objectives.quality) bestQualIdx = i;
      }
      picked.push(normalised.splice(bestQualIdx, 1)[0]);
    }

    // Iteratively pick the solution that maximises the minimum distance to already picked solutions
    while (picked.length < maxBundles && normalised.length > 0) {
      let maxMinDist = -1;
      let nextIdx = -1;

      for (let i = 0; i < normalised.length; i++) {
        let minDist = Infinity;
        for (const p of picked) {
          const dist = Math.sqrt(
            Math.pow(normalised[i].norm[0] - p.norm[0], 2) +
            Math.pow(normalised[i].norm[1] - p.norm[1], 2) +
            Math.pow(normalised[i].norm[2] - p.norm[2], 2)
          );
          if (dist < minDist) minDist = dist;
        }
        if (minDist > maxMinDist) {
          maxMinDist = minDist;
          nextIdx = i;
        }
      }
      picked.push(normalised.splice(nextIdx, 1)[0]);
    }

    return picked.sort((a, b) => a.objectives.cost - b.objectives.cost).map(p => {
      const { norm, ...rest } = p;
      return rest;
    });
  }

  // ─── Bundle Labelling ─────────────────────────────────────────────────────────

  private labelBundles(
    solutions: ReturnType<typeof paretoFront>,
    categoryGroups: VendorCandidate[][],
    budget: number
  ): VendorBundle[] {
    // ── Compute greedy baseline: one per category ──
    const baselineVendors: VendorCandidate[] = categoryGroups.map(group => {
      // Sort each group by quality/cost ratio or just quality
      const sorted = [...group].sort((a, b) => b.qualityScore - a.qualityScore);
      return sorted[0];
    });

    // Repair greedy if over budget
    let greedyCost = baselineVendors.reduce((s, v) => s + v.baseCost, 0);
    const repairedGreedy = [...baselineVendors];
    if (greedyCost > budget) {
      const sortedByCost = repairedGreedy
        .map((v, i) => ({ v, i }))
        .sort((a, b) => b.v.baseCost - a.v.baseCost);
      
      for (const { i, v } of sortedByCost) {
        if (greedyCost <= budget) break;
        // Swap to cheapest in same category
        const group = categoryGroups[i];
        const cheapestInCat = [...group].sort((a, b) => a.baseCost - b.baseCost)[0];
        greedyCost = greedyCost - v.baseCost + cheapestInCat.baseCost;
        repairedGreedy[i] = cheapestInCat;
      }
    }

    const greedyCount = repairedGreedy.length;
    const greedyQuality = repairedGreedy.reduce((s, v) => s + v.qualityScore, 0);
    const greedyMeanQuality = greedyCount > 0 ? greedyQuality / greedyCount : 0;

    // Build result objects
    const rawBundles = solutions.map((sol) => {
      const selectedVendors: VendorCandidate[] = sol.selection.map((vIdx, catIdx) => 
        categoryGroups[catIdx][vIdx]
      );
      const totalCost = sol.objectives.cost;
      const totalQuality = sol.objectives.quality;
      const averageRating = selectedVendors.length > 0 
        ? selectedVendors.reduce((s, v) => s + v.rating, 0) / selectedVendors.length 
        : 0;
      const improvement =
        greedyMeanQuality > 0
          ? ((totalQuality - greedyMeanQuality) / greedyMeanQuality) * 100
          : 0;
      return {
        vendors: selectedVendors,
        totalCost,
        totalQuality,
        averageRating,
        improvementOverGreedy: Math.round(improvement * 10) / 10,
      };
    });

    // Sort by quality descending, tie-break by cost ascending
    // This ensures "Premium" always has the highest quality score
    const sortedByQuality = [...rawBundles].sort(
      (a, b) =>
        b.totalQuality - a.totalQuality || a.totalCost - b.totalCost
    );

    // Assign labels:
    //   - highest quality bundle  → "Premium"
    //   - lowest cost bundle      → "Budget Pick"
    //   - everything in between   → "Balanced"
    // Among remaining bundles (all except index 0), find the lowest-cost one = Budget Pick
    const remaining = sortedByQuality.slice(1);
    let budgetPickIdx = 0;
    for (let i = 1; i < remaining.length; i++) {
      if (
        remaining[i].totalCost < remaining[budgetPickIdx].totalCost ||
        (remaining[i].totalCost === remaining[budgetPickIdx].totalCost &&
          remaining[i].totalQuality > remaining[budgetPickIdx].totalQuality)
      ) {
        budgetPickIdx = i;
      }
    }

    return sortedByQuality.map((bundle, i) => {
      let label: VendorBundle["label"];
      if (i === 0) {
        label = "Premium";
      } else if (remaining.length > 0 && bundle === remaining[budgetPickIdx]) {
        label = "Budget Pick";
      } else {
        label = "Balanced";
      }
      return { label, ...bundle };
    });
  }

  // ─── Metrics ─────────────────────────────────────────────────────────────────

  getMetrics(): AlgorithmMetrics {
    return this.metrics;
  }

  private buildMetrics(startMs: number, outputSize: number): AlgorithmMetrics {
    return {
      executionTimeMs: Date.now() - startMs,
      inputSize: this.metrics.inputSize,
      outputSize,
      version: this.version,
      timestamp: new Date(),
    };
  }
}
