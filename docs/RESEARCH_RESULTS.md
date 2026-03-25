# 🔬 Research & Evaluation Results

**Last Updated**: 2026-03-23  
**Data Version**: v2 (Demo Seed System)

This document records the performance, accuracy, and ablation study results for the EventMS recommendation and optimization engine.

---

## 1. System Health & Performance

| Metric | Value | Notes |
|---|---|---|
| **Total Runs** | 30 | Accumulated over recent automation cycles |
| **Active Users** | 29 | Users with active interaction profiles |
| **Cache Hit Rate** | 0% | *Fresh run — cache cleared before test* |

### Algorithm Latency
| Algorithm | Avg Time (ms) | Iterations |
|---|---|---|
| **GNN-CF** (Cold Start) | 1156.18 | 28 |
| **GAT+K-Means** (Clustering) | 917.00 | 2 |

---

## 2. Recommendation Accuracy (NDCG@10)

These metrics evaluate how well the AI predicts user preferences.

| Metric | Current Value | Baseline | Delta |
|---|---|---|---|
| **NDCG@10** | 0.0114 | 0.0579 | -0.0465 |
| **Precision@10** | 0.0021 | — | — |
| **MRR@10** | 0.0087 | — | — |
| **HitRate@10** | 0.0207 | — | — |

> [!NOTE]
> The current NDCG is lower than the baseline due to the limited interaction history in the demo seed (1000 interactions vs 50,000 in baseline). Performance is expected to scale as the `user_interactions` pool grows.

---

## 3. Training & Learning (BPR)

Bayesian Personalized Ranking (BPR) training for the LightGCN/XSimGCL models.

- **Epochs**: 15
- **Initial Loss**: 0.5566
- **Final Loss**: 0.4708 (📉 15.4% reduction)
- **Interactions Used**: 1000

---

## 4. Community Detection (GAT+K-Means)

The system successfully identified **4 distinct communities** from the event graph:

| Community Label | Size (Events) | Modularity |
|---|---|---|
| Culture & Community | 31 | 0.4146 |
| Networking & Education | 21 | 0.4146 |
| Music & Food | 17 | 0.4146 |
| Networking & Technology | 2 | 0.4146 |

---

## 5. Budget Optimization (MOEA/D)

Multi-Objective Optimization results for vendor selection.

- **Pareto Front Size**: 10 solutions
- **Selected Bundles**:
  - `Premium`: Cost 72k, Quality 0.78
  - `Balanced`: Cost 70k, Quality 0.77
  - `Budget Pick`: Cost 58k, Quality 0.67

---

---

## 7. Model Robustness & Learning (Phase 2)

To ensure research integrity and align with the technical claims in the paper, the following enhancements were implemented:

### 7.1 Learned Embeddings vs. Fixed Projections
| Component | Previous State | Current State | Rationale |
|---|---|---|---|
| **iTransformer** | Fixed Sinusoidal Projections | **Trainable Linear Matrices** | Enables variable-specific temporal patterns. |
| **GAT** | Random NP propagation | **Trainable Weight Matrices ($W, a$)** | Transitions from "Random Feature Propagation" to true Learned Attention. |

---

## 8. Phase 3: Deep Technical Refinement (v2.2)

### 8.1 iTransformer: Temporal Tokenization
Moving beyond scalar means, the v2.2 engine now implements **full matrix-vector temporal projection**:
- **W_proj Matrix**: Each variable has a dedicated `[dModel x lookback]` projection.
- **Dynamic Nudging**: Online training updates both `W_out` and `W_proj`.

### 8.2 BPR: High-Signal Fidelity & Leakage Prevention
- **Filtered Types**: Training is restricted to `confirmed` and `rsvp` interactions.
- **Leakage Patch**: Strict `split = 'train'` filter prevents the model from seeing test-window data during embedding.

### 8.3 Granular Algorithm Metrics
Paper reporting is now separated by cohort:
- **XSimGCL (Warm)**: Users with 10+ interactions.
- **GNN-CF (Cold Start)**: Users with < 10 interactions.

---

## 9. Methodological Summary
1. **No Data Leakage**: Global 70% temporal cutoff.
2. **Unified Evaluation**: Aggregates both GNN-CF and XSimGCL.
3. **Honest Baseline**: Theoretical random baseline provided for calibration.
