# Pareto Choice Budget Optimiser (MOEA/D-DRA-NEF) Flaws

This document tracks identified flaws, logical errors, and incomplete implementations in the budget optimiser algorithm.

## 1. Dimensionality Collapse in Final Selection
**Location:** `src/lib/algorithms/moea-d/index.ts` -> `selectDiverseBundles`

**Issue:** 
The algorithm is designed to optimise over a 3D objective space (Cost, Quality, Diversity). However, when selecting the final `K` bundles (e.g., 5) from the computed Pareto front, the code exclusively sorts by the **Cost** axis and selects evenly spaced indices.

```typescript
// Sort by cost ascending — spread evenly
const sorted = [...front].sort(
  (a, b) => a.objectives.cost - b.objectives.cost
);
const step = (sorted.length - 1) / (maxBundles - 1);
```

**Consequences:**
- The final selection ignores the Quality and Diversity dimensions entirely.
- Solutions that are mathematically optimal on Quality or Diversity, but fall in the "middle" of the Cost spectrum, will likely be skipped.
- Two solutions with similar costs but wildly different quality/diversity profiles are treated as adjacent, meaning the user may receive redundant options instead of genuinely diverse trade-offs.

**Proposed Fix:** 
Implement a 3D distance-based selection (e.g., K-Means clustering on normalised objective space, or a maximin distance approach) to guarantee a diverse spread across all objectives.

## 2. The Diversity Objective is Mathematically Broken (Constant)
**Location:** `src/lib/algorithms/moea-d/pareto.ts` -> `evaluate()`

**Issue:** 
The algorithm aims to maximise Category Diversity using Shannon entropy. However, the data structure forces exactly one vendor to be chosen per category group before evaluation:
```typescript
for (let i = 0; i < categoryGroups.length; i++) {
  const idx = selection[i]; // Picks EXACTLY 1 vendor per category
  selected.push(categoryGroups[i][idx]);
}
// ...
const categories = selected.map(v => v.category);
const diversity = shannonEntropy(categories);
```

**Consequences:**
Since the solution encoding strictly mandates picking exactly one vendor per unique category, the `categories` array will *always* end up being exactly `['photography', 'catering', 'venue', ...]`. 
Because the distribution of categories is identical for every single generated solution, the **Shannon entropy (diversity) evaluates to the exact same constant value** for all feasible solutions. The algorithm is practically running a 2D optimisation (Cost vs Quality) while burning computational resources pretending to perform 3D optimisation.

**Proposed Fix:** 
If the business rule is "exactly one vendor per category", then Diversity should be removed as an objective entirely, dropping the algorithm to 2D (Cost vs Quality). If the business rule allows selecting multiple vendors per category (e.g., two photographers) or skipping categories, the solution encoding (`selection: number[]`) must be rewritten to support variable-length selections or binary absence/presence flags.
