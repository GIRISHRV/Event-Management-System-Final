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
import { shannonEntropy } from "../shared/matrix";
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

    // ── Step 2: Generate weight vectors (H=6 → 28 subproblems) ───────────────
    const weightVectors = generateWeightVectors(this.config.weightDivisions);

    // ── Step 3: Run MOEA/D-DRA-NEF ───────────────────────────────────────────
    const population = runMOEAD(
      affordable,
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
    const selected = this.selectDiverseBundles(front, affordable, 5);

    // ── Step 6: Label and build VendorBundle objects ──────────────────────────
    const bundles = this.labelBundles(selected, affordable, budget);

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
    vendors: VendorCandidate[],
    maxBundles: number
  ) {
    if (front.length <= maxBundles) return front;

    // Sort by cost ascending — spread evenly
    const sorted = [...front].sort(
      (a, b) => a.objectives.cost - b.objectives.cost
    );

    // Pick first (cheapest), last (most expensive), and evenly spaced middle ones
    const step = (sorted.length - 1) / (maxBundles - 1);
    const picked: typeof sorted = [];
    for (let i = 0; i < maxBundles; i++) {
      const idx = Math.round(i * step);
      picked.push(sorted[Math.min(idx, sorted.length - 1)]);
    }

    return picked;
  }

  // ─── Bundle Labelling ─────────────────────────────────────────────────────────

  private labelBundles(
    solutions: ReturnType<typeof paretoFront>,
    vendors: VendorCandidate[],
    budget: number
  ): VendorBundle[] {
    // Compute greedy baseline: sort by quality desc, pick until budget exhausted
    const greedySorted = [...vendors].sort(
      (a, b) => b.qualityScore - a.qualityScore
    );
    let greedyCost = 0;
    let greedyQuality = 0;
    let greedyCount = 0;
    for (const v of greedySorted) {
      if (greedyCost + v.baseCost <= budget) {
        greedyCost += v.baseCost;
        greedyQuality += v.qualityScore;
        greedyCount++;
      }
    }
    const greedyMeanQuality = greedyCount > 0 ? greedyQuality / greedyCount : 0;

    // Build result objects first (before labelling so we can inspect quality/cost)
    const rawBundles = solutions.map((sol) => {
      const selectedVendors = vendors.filter((_, j) => sol.selection[j]);
      const totalCost = sol.objectives.cost;
      const totalQuality = sol.objectives.quality;
      const categories = selectedVendors.map(v => v.category);
      const categoryDiversity = shannonEntropy(categories);
      const improvement =
        greedyMeanQuality > 0
          ? ((totalQuality - greedyMeanQuality) / greedyMeanQuality) * 100
          : 0;
      return {
        vendors: selectedVendors,
        totalCost,
        totalQuality,
        categoryDiversity,
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
