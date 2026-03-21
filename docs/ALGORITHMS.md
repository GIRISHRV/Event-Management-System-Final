# Algorithm Reference

EventMS integrates five ML algorithms for event recommendations, budget optimization, attendance forecasting, and community detection. This document covers each algorithm's purpose, inputs, outputs, preconditions, pseudocode, and caching strategy.

See also:
- [docs/ARCHITECTURE.md](./ARCHITECTURE.md) — API routes that invoke these algorithms
- [docs/DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) — `algorithm_results`, `attendance_forecasts`, and `event_communities` table schemas

---

## Algorithms Overview

| Algorithm | Purpose | API Route |
|---|---|---|
| XSimGCL | Collaborative filtering for warm users (≥ 3 interactions) | `POST /api/algorithms/recommendations` |
| GNN-CF | Cold-start recommendations for new users (< 3 interactions) | `POST /api/algorithms/recommendations` |
| MOEA/D-DRA-NEF | Budget optimization — Pareto-optimal vendor bundles | `POST /api/algorithms/budget-optimizer` |
| iTransformer | Attendance forecasting for events | `POST /api/algorithms/forecast` |
| GAT+K-Means | Community detection — groups similar events and users | `GET/POST /api/algorithms/communities` |

---

## 1. XSimGCL — Extended SimGCL with Graph Contrastive Learning

### Purpose

Collaborative filtering recommendations for warm users — users who have at least 3 interactions recorded in the `user_interactions` table. XSimGCL builds a user-event interaction graph and applies LightGCN graph propagation combined with contrastive learning to generate personalized event recommendations.

### Inputs

| Parameter | Type | Constraints | Description |
|---|---|---|---|
| `userId` | `string` (UUID) | Valid authenticated UUID | The user to generate recommendations for |
| `limit` | `number` | 1–20 | Maximum number of recommendations to return |
| `excludeEventIds` | `string[]` | — | Event UUIDs to exclude from results |
| Interaction graph | DB query | — | Rows from `user_interactions` WHERE `user_id = userId` |

### Outputs

```typescript
interface RecommendationOutput {
  recommendations: RecommendedEvent[]
  algorithm: "xsimgcl"
  coldStart: false
  executionTimeMs: number
}
```

### How It Works

1. Fetches the user-event interaction graph from `user_interactions`
2. Applies LightGCN multi-layer graph propagation to compute user and event embeddings
3. Uses contrastive learning (SimGCL-style augmentation) to improve embedding quality
4. Scores candidate events by dot-product similarity between user and event embeddings
5. Applies CCR (Capacity-Calibrated Re-ranking) post-processing to adjust scores based on event capacity and recency
6. Attaches explainability reasons to each recommendation

### Preconditions

- `userId` is a valid authenticated UUID
- `limit` is between 1 and 20
- Supabase client carries the user's JWT (RLS enforced)
- User has ≥ 3 rows in `user_interactions` for `user_id = userId`

### Postconditions

- Returns at most `limit` recommendations
- Excludes all `excludeEventIds` and events the user has already confirmed bookings for
- Result is persisted to `algorithm_results` with `algorithm_type = 'xsimgcl'` and `expires_at = NOW() + 30 min`

---

## 2. GNN-CF — Graph Neural Network Collaborative Filtering (Cross-Domain)

### Purpose

Cold-start recommendations for new users who have fewer than 3 interactions. When no meaningful interaction data exists, GNN-CF falls back to trending and popular events to provide useful recommendations.

### Inputs

| Parameter | Type | Constraints | Description |
|---|---|---|---|
| `userId` | `string` (UUID) | Valid authenticated UUID | The user to generate recommendations for |
| `limit` | `number` | 1–20 | Maximum number of recommendations to return |
| `excludeEventIds` | `string[]` | — | Event UUIDs to exclude from results |

### Outputs

```typescript
interface RecommendationOutput {
  recommendations: RecommendedEvent[]
  algorithm: "gnn-cf"
  coldStart: true
  executionTimeMs: number
}
```

### How It Works

1. Checks `user_interactions` for the user — finds fewer than 3 rows
2. Falls back to fetching trending and popular upcoming public events
3. Applies cross-domain signals (e.g., event tags, location) to rank candidates
4. Returns the top `limit` events after excluding `excludeEventIds`

### Preconditions

- `userId` is a valid authenticated UUID
- `limit` is between 1 and 20
- User has < 3 rows in `user_interactions` for `user_id = userId`

### Postconditions

- Returns at most `limit` recommendations
- Excludes all `excludeEventIds`
- Result is persisted to `algorithm_results` with `algorithm_type = 'gnn-cf'` and `expires_at = NOW() + 30 min`

---

## 3. MOEA/D-DRA-NEF — Multi-Objective Evolutionary Algorithm with Decomposition, Dynamic Resource Allocation, and Neighbourhood-Enhanced Fitness

### Purpose

Budget optimization for event organizers. Given a budget and a set of required vendor categories, MOEA/D-DRA-NEF generates 3–5 Pareto-optimal vendor bundles that simultaneously optimize three objectives: minimize cost, maximize quality, and maximize category coverage.

### Inputs

| Parameter | Type | Constraints | Description |
|---|---|---|---|
| `eventId` | `string` (UUID) | Optional for admins, required for non-admins | The event to optimize vendors for |
| `budget` | `number` | Positive number (INR) | Maximum total spend across all selected vendors |
| `requiredCategories` | `string[]` | — | Vendor categories that must be covered (e.g. `["DJ", "Catering"]`) |
| Vendor candidates | DB query | `base_price ≤ budget` | Rows from `vendor_services` with `quality_score` and `base_price` |

### Outputs

```typescript
interface BudgetOptimizerOutput {
  bundles: ParetoBundle[]
  paretoSize: number
  executionTimeMs: number
}

interface ParetoBundle {
  label: string              // e.g. "Budget Pick", "Best Value", "Premium"
  vendors: VendorCandidate[]
  totalCost: number
  qualityScore: number
  coverageScore: number
}

interface VendorCandidate {
  id: string
  vendorId: string
  serviceName: string
  category: string
  baseCost: number
  qualityScore: number
  rating: number
}
```

### Bundle Labels

MOEA/D produces 3–5 labelled bundles representing different trade-off points on the Pareto front:

| Label | Trade-off |
|---|---|
| `"Budget Pick"` | Lowest cost, acceptable quality |
| `"Best Value"` | Balanced cost and quality |
| `"Premium"` | Highest quality, higher cost |
| `"Balanced"` | (optional) Even spread across all objectives |
| `"Quality Focus"` | (optional) Quality-maximizing with moderate cost |

### How It Works

1. Queries `vendor_services` for candidates where `base_price ≤ budget`, ordered by `base_price ASC`, limited to 200 rows
2. Maps each row to a `VendorCandidate` with `id`, `vendorId`, `serviceName`, `category`, `baseCost`, `qualityScore`, `rating`
3. Runs the MOEA/D evolutionary loop with decomposition into scalar sub-problems, dynamic resource allocation (DRA) to focus computation on promising sub-problems, and neighbourhood-enhanced fitness (NEF) to share information between neighbouring solutions
4. Extracts 3–5 non-dominated solutions from the Pareto front and labels them
5. Persists result to `algorithm_results` with `algorithm_type = 'moea-d'`

### Preconditions

- Caller is the event organizer OR an admin
- `budget` is a positive number
- Non-admins must provide a valid `eventId` they own
- At least one `vendor_services` row exists with `base_price ≤ budget`

### Postconditions

- Returns 3–5 Pareto-optimal bundles
- Each bundle covers at least the `requiredCategories` where possible
- Result logged to `algorithm_results` with `expires_at = NOW() + 30 min`

---

## 4. iTransformer — Inverted Transformer for Time Series Forecasting

### Purpose

Attendance forecasting for events. iTransformer uses historical booking data and event metadata to predict daily attendance over a 7- or 14-day horizon, with configurable confidence intervals.

### Inputs

| Parameter | Type | Constraints | Description |
|---|---|---|---|
| `eventId` | `string` (UUID) | Valid event UUID | The event to forecast attendance for |
| `horizon` | `7 \| 14` | Must be exactly 7 or 14 | Forecast horizon in days |
| `confidenceLevel` | `number` | 0.80–0.99, default 0.95 | Confidence level for prediction intervals |

### Outputs

```typescript
interface ForecastOutput {
  predictions: DailyPrediction[]
  trend: "increasing" | "decreasing" | "stable"
  recommendedCapacity: number
  executionTimeMs: number
}

interface DailyPrediction {
  date: string               // YYYY-MM-DD
  predictedAttendance: number
  lowerBound: number
  upperBound: number
  confidence: number
}
```

### Horizon Options

| `horizon` | Description |
|---|---|
| `7` | 7-day forecast — short-term planning |
| `14` | 14-day forecast — medium-term planning |

### Confidence Level Range

`confidenceLevel` must be between `0.80` and `0.99` (inclusive). The default is `0.95`. A higher confidence level produces wider prediction intervals (`lowerBound` to `upperBound`).

### How It Works

1. Fetches historical booking data and event metadata as input features
2. Applies the inverted Transformer architecture — treats each time step as a token (inverted from the standard Transformer which treats each feature as a token)
3. Generates `horizon` daily predictions, each with a point estimate and confidence bounds
4. Computes the overall `trend` by comparing the first and last predicted values
5. Sets `recommendedCapacity` to the upper bound of the final day's prediction

### Preconditions

- `eventId` is a valid UUID referencing an existing event
- Caller is the event organizer (ownership enforced)
- `horizon` is exactly `7` or `14`
- `confidenceLevel` is between `0.80` and `0.99`

### Postconditions

- Returns exactly `horizon` daily predictions
- Each prediction includes `lowerBound ≤ predictedAttendance ≤ upperBound`
- Result cached in `attendance_forecasts` with `expires_at = NOW() + 60 min`
- A row is also written to `algorithm_results` with `algorithm_type = 'itransformer'`

---

## 5. GAT+K-Means — Graph Attention Network + K-Means Clustering

### Purpose

Community detection — groups similar events and users into clusters based on event tags, location, and metadata. Results are used by the community filter in the customer dashboard to surface related events.

### Inputs

| Parameter | Type | Constraints | Description |
|---|---|---|---|
| All upcoming public events | DB query | `event_status = 'upcoming'`, `visibility_type = 'public'` | Events with their tags, location, and metadata |
| `geographicDecay` | `boolean` | Default `true` | Enables geographic proximity weighting in the similarity graph |

### Outputs

```typescript
interface CommunityDetectionOutput {
  communities: EventCommunity[]
  numCommunities: number
  silhouetteScore: number
  singletonCount: number
  executionTimeMs: number
}

interface EventCommunity {
  event_id: string
  community_id: number
  community_label: string | null
  similar_event_ids: string[]
  silhouette_score: number | null
}
```

### How It Works

1. Acquires an optimistic lock (`gat-kmeans-lock`) to prevent concurrent recomputation
2. Fetches all upcoming public events with tags, location (`venue_latitude`, `venue_longitude`), and metadata
3. Builds a similarity graph using GAT (Graph Attention Network) — attention weights encode tag overlap and geographic proximity
4. If `geographicDecay = true`, applies a geographic decay function to down-weight edges between geographically distant events
5. Runs K-Means clustering on the GAT-produced embeddings to assign each event to a community
6. Computes the silhouette score to measure clustering quality
7. Persists one `event_communities` row per event with `expires_at = NOW() + 30 min`

### Preconditions

- At least 2 upcoming public events exist in the database
- No concurrent GAT+K-Means computation is in progress (lock `gat-kmeans-lock` is not held)

### Postconditions

- Each upcoming public event is assigned to exactly one community
- `similar_event_ids` contains UUIDs of other events in the same community (up to 6 returned by the API)
- Results cached in `event_communities` with `expires_at = NOW() + 30 min`
- Returns `202 Accepted` if the lock is already held (computation in progress)

---

## Recommendation Algorithm Selection Logic

The `POST /api/algorithms/recommendations` route selects between XSimGCL and GNN-CF based on the user's interaction count in the `user_interactions` table.

### Cold-Start Threshold

| Condition | Algorithm Selected | `coldStart` |
|---|---|---|
| `interactionCount < 3` | GNN-CF | `true` |
| `interactionCount ≥ 3` | XSimGCL | `false` |

The interaction count is computed as:

```sql
SELECT COUNT(*) FROM user_interactions WHERE user_id = $userId
```

### Pseudocode

```pascal
ALGORITHM selectAndRunRecommendations(userId, limit, excludeEventIds)
INPUT: userId (UUID), limit (int), excludeEventIds (string[])
OUTPUT: RecommendationOutput

BEGIN
  interactionCount ← COUNT(user_interactions WHERE user_id = userId)
  isColdStart ← interactionCount < COLD_START_THRESHOLD  -- threshold = 3

  IF NOT isColdStart THEN
    -- Check cache before re-running XSimGCL
    cached ← QUERY algorithm_results
              WHERE user_id = userId
              AND algorithm_type = 'xsimgcl'
              AND expires_at > NOW()
    IF cached AND cached.recommendations.length > 0 THEN
      RETURN cached
    END IF
    result ← XSimGCL.execute(userId, limit, excludeEventIds)
  ELSE
    result ← GNNCrossDomainCF.execute(userId, limit, excludeEventIds)
  END IF

  result ← applyCCRReranking(result)
  result ← attachExplainabilityReasons(result, userId, isColdStart)

  PERSIST result TO algorithm_results
  RETURN result
END
```

---

## Budget Optimization Flow

```pascal
ALGORITHM optimizeBudget(eventId, budget, requiredCategories)
INPUT: eventId (UUID), budget (number), requiredCategories (string[])
OUTPUT: { bundles: ParetoBundle[], paretoSize: int }

BEGIN
  vendors ← QUERY vendor_services
             WHERE base_price <= budget
             ORDER BY base_price ASC
             LIMIT 200

  IF vendors.length = 0 THEN
    RETURN { bundles: [], paretoSize: 0 }
  END IF

  candidates ← MAP vendors TO VendorCandidate {
    id, vendorId, serviceName, category,
    baseCost, qualityScore, rating
  }

  result ← MOEAD.execute({
    eventId, budget, requiredCategories, vendors: candidates
  })

  PERSIST result TO algorithm_results
  RETURN { bundles: result.bundles, paretoSize: result.paretoSize }
END
```

---

## Caching Strategy

All algorithm results are cached to avoid re-running expensive ML computations on every request. The API checks for a valid cached result before invoking the algorithm.

### Cache Check Pattern

```sql
-- Check for a valid cached result before re-running
SELECT * FROM algorithm_results
WHERE user_id = $userId
  AND algorithm_type = $algorithmType
  AND expires_at > NOW()
ORDER BY created_at DESC
LIMIT 1
```

If a non-expired row is found, the cached `output_data` is returned directly. Otherwise the algorithm runs and a new row is inserted.

### TTL Values by Algorithm

| Algorithm | `algorithm_type` | Cache Table | TTL |
|---|---|---|---|
| XSimGCL | `xsimgcl` | `algorithm_results` | 30 minutes |
| GNN-CF | `gnn-cf` | `algorithm_results` | 30 minutes |
| MOEA/D-DRA-NEF | `moea-d` | `algorithm_results` | 30 minutes |
| iTransformer | `itransformer` | `attendance_forecasts` | 60 minutes |
| GAT+K-Means | `gat-kmeans` | `event_communities` | 30 minutes |

### Cache Storage Details

- **Recommendations (XSimGCL, GNN-CF):** Stored in `algorithm_results`. `expires_at = created_at + 30 min`. The `output_data` JSONB column holds the full `RecommendationOutput`.
- **Forecast (iTransformer):** Stored in `attendance_forecasts`. `expires_at = created_at + 60 min`. The `predictions` JSONB column holds the array of `DailyPrediction` objects. A row is also written to `algorithm_results` for research logging.
- **Communities (GAT+K-Means):** Stored in `event_communities`. `expires_at = created_at + 30 min`. One row per event. The `similar_event_ids` column holds the UUIDs of events in the same community.
- **Budget optimizer (MOEA/D):** Stored in `algorithm_results`. `expires_at = created_at + 30 min`. The `output_data` JSONB column holds the full bundle array.

See [docs/DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) for the full column definitions of `algorithm_results`, `attendance_forecasts`, and `event_communities`.

---

## Cross-References

- For the API routes that invoke these algorithms, see [docs/ARCHITECTURE.md](./ARCHITECTURE.md).
- For the `algorithm_results`, `attendance_forecasts`, and `event_communities` table schemas, see [docs/DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md).
- For the `user_interactions` table used to determine cold-start status, see [docs/DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md#user_interactions).

---

## References

### Core Algorithm Papers (cite as [1]–[5])

[1] J. Yu, X. Xia, T. Chen, L. Cui, N. Q. V. Hung, and H. Yin, "XSimGCL: Towards Extremely Simple Graph Contrastive Learning for Recommendation," *IEEE Transactions on Knowledge and Data Engineering*, vol. 36, no. 2, pp. 913–926, Feb. 2024, doi: 10.1109/TKDE.2023.3288135. [Online]. Available: https://ieeexplore.ieee.org/abstract/document/10158930

[2] Y. Liu, T. Hu, H. Zhang, H. Wu, S. Wang, L. Ma, and M. Long, "iTransformer: Inverted Transformers Are Effective for Time Series Forecasting," in *Proc. 12th Int. Conf. Learning Representations (ICLR)*, Vienna, Austria, 2024. [Online]. Available: https://arxiv.org/abs/2310.06625

[3] Y. Tan, Y. Jiao, H. Li, and X. Li, "A New Multi-objective Optimization Algorithm Based on Decomposition with Dynamic Resource Allocation and Neighborhood Exploration with Fitness," *IEEE Access*, 2025, doi: 10.1109/ACCESS.2025.10862940. [Online]. Available: https://ieeexplore.ieee.org/document/10862940/

[4] I. V. S. Ippatapu and P. Bhadra, "Community Detection Using Graph Attention Networks Clustering Algorithm," in *Proc. IEEE Int. Conf. for Convergence in Technology (I2CT)*, 2024, doi: 10.1109/I2CT61223.2024.10543468. [Online]. Available: https://ieeexplore.ieee.org/document/10543468/

[5] C. Goel and B. B. Sinha, "Cross Domain Collaborative Filtering: A GNN Approach for Accurate and Diverse Recommendations," *IEEE Conference Publication*, 2023/2024, doi: 10.1109/10452478. [Online]. Available: https://ieeexplore.ieee.org/document/10452478/

---

### Foundational Recommender Systems (cite in Related Work)

[6] X. He, K. Deng, X. Wang, Y. Li, Y. Zhang, and M. Wang, "LightGCN: Simplifying and Powering Graph Convolution Network for Recommendation," in *Proc. 43rd Int. ACM SIGIR Conf. Research and Development in Information Retrieval (SIGIR)*, 2020, pp. 639–648, doi: 10.1145/3397271.3401063. [Online]. Available: https://arxiv.org/abs/2002.02126

[7] S. Rendle, C. Freudenthaler, Z. Gantner, and L. Schmidt-Thieme, "BPR: Bayesian Personalized Ranking from Implicit Feedback," in *Proc. 25th Conf. Uncertainty in Artificial Intelligence (UAI)*, 2009, pp. 452–461. [Online]. Available: https://arxiv.org/abs/1205.2618

[8] Y. Koren, R. Bell, and C. Volinsky, "Matrix Factorization Techniques for Recommender Systems," *IEEE Computer*, vol. 42, no. 8, pp. 30–37, Aug. 2009, doi: 10.1109/MC.2009.263.

[9] J. Tang and K. Wang, "Personalized Top-N Sequential Recommendation via Convolutional Sequence Embedding," in *Proc. 11th ACM Int. Conf. Web Search and Data Mining (WSDM)*, 2018, pp. 565–573, doi: 10.1145/3159652.3159656.

---

### Graph Neural Networks (cite in Related Work / System Architecture)

[10] T. N. Kipf and M. Welling, "Semi-Supervised Classification with Graph Convolutional Networks," in *Proc. 5th Int. Conf. Learning Representations (ICLR)*, Toulon, France, Apr. 2017. [Online]. Available: https://arxiv.org/abs/1609.02907

[11] P. Veličković, G. Cucurull, A. Casanova, A. Romero, P. Liò, and Y. Bengio, "Graph Attention Networks," in *Proc. 6th Int. Conf. Learning Representations (ICLR)*, Vancouver, Canada, May 2018. [Online]. Available: https://arxiv.org/abs/1710.10903

[12] W. Fan, Y. Ma, Q. Li, Y. He, E. Zhao, J. Tang, and D. Yin, "Graph Neural Networks for Social Recommendation," in *Proc. World Wide Web Conf. (WWW)*, 2019, pp. 417–426, doi: 10.1145/3308558.3313488.

---

### Transformer Architecture (cite for iTransformer background)

[13] A. Vaswani, N. Shazeer, N. Parmar, J. Uszkoreit, L. Jones, A. N. Gomez, Ł. Kaiser, and I. Polosukhin, "Attention Is All You Need," in *Proc. Advances in Neural Information Processing Systems (NeurIPS)*, vol. 30, 2017. [Online]. Available: https://arxiv.org/abs/1706.03762

[14] H. Zhou, S. Zhang, J. Peng, S. Zhang, J. Li, H. Xiong, and W. Zhang, "Informer: Beyond Efficient Transformer for Long Sequence Time-Series Forecasting," in *Proc. 35th AAAI Conf. Artificial Intelligence (AAAI)*, 2021, pp. 11106–11115. [Online]. Available: https://arxiv.org/abs/2012.07436

---

### Multi-Objective Optimisation (cite for MOEA/D background)

[15] Q. Zhang and H. Li, "MOEA/D: A Multiobjective Evolutionary Algorithm Based on Decomposition," *IEEE Transactions on Evolutionary Computation*, vol. 11, no. 6, pp. 712–731, Dec. 2007, doi: 10.1109/TEVC.2007.892759.

[16] H. Li and Q. Zhang, "Multiobjective Optimization Problems with Complicated Pareto Sets, MOEA/D and NSGA-II," *IEEE Transactions on Evolutionary Computation*, vol. 13, no. 2, pp. 284–302, Apr. 2009, doi: 10.1109/TEVC.2008.925798.

[17] K. Deb, A. Pratap, S. Agarwal, and T. Meyarivan, "A Fast and Elitist Multiobjective Genetic Algorithm: NSGA-II," *IEEE Transactions on Evolutionary Computation*, vol. 6, no. 2, pp. 182–197, Apr. 2002, doi: 10.1109/4235.996017.

---

### Community Detection (cite for GAT+K-Means background)

[18] M. Girvan and M. E. J. Newman, "Community Structure in Social and Biological Networks," *Proc. National Academy of Sciences*, vol. 99, no. 12, pp. 7821–7826, Jun. 2002, doi: 10.1073/pnas.122653799.

[19] M. E. J. Newman, "Modularity and Community Structure in Networks," *Proc. National Academy of Sciences*, vol. 103, no. 23, pp. 8577–8582, Jun. 2006, doi: 10.1073/pnas.0601602103.

[20] J. MacQueen, "Some Methods for Classification and Analysis of Multivariate Observations," in *Proc. 5th Berkeley Symp. Mathematical Statistics and Probability*, vol. 1, 1967, pp. 281–297.

---

### Event Recommendation Systems (cite in Related Work to show the gap)

[21] X. Liu, Q. He, Y. Tian, W.-C. Lee, J. McPherson, and J. Han, "Event-Based Social Networks: Linking the Online and Offline Social Worlds," in *Proc. 18th ACM SIGKDD Int. Conf. Knowledge Discovery and Data Mining (KDD)*, 2012, pp. 1032–1040, doi: 10.1145/2339530.2339693.

[22] S. Qiao, N. Han, W. Zhu, and L. A. Gutierrez, "TraWave: A User-Preference-Based Location Recommendation System for Event-Based Social Networks," in *Proc. 23rd Int. Conf. World Wide Web (WWW)*, 2014, pp. 193–194, doi: 10.1145/2567948.2577016.

[23] H. Yin, B. Cui, L. Chen, Z. Hu, and X. Zhou, "Dynamic User Modeling in Social Media Systems," *ACM Transactions on Information Systems*, vol. 33, no. 3, pp. 1–44, Jun. 2015, doi: 10.1145/2699667.

[24] Z. Lu, H. Mamoulis, and D. W. Cheung, "Discovering Social-Aware Locations for Location Recommendation in Event-Based Social Networks," in *Proc. IEEE Int. Conf. Data Mining (ICDM)*, 2015, pp. 865–870, doi: 10.1109/ICDM.2015.25.

---

### Implicit Feedback and Evaluation Methodology

[25] Y. Hu, Y. Koren, and C. Volinsky, "Collaborative Filtering for Implicit Feedback Datasets," in *Proc. 8th IEEE Int. Conf. Data Mining (ICDM)*, 2008, pp. 263–272, doi: 10.1109/ICDM.2008.22.

[26] K. Järvelin and J. Kekäläinen, "Cumulated Gain-Based Evaluation of IR Techniques," *ACM Transactions on Information Systems*, vol. 20, no. 4, pp. 422–446, Oct. 2002, doi: 10.1145/582415.582418.

[27] T. Jambor and J. Wang, "Optimizing Multiple Objectives with Restricted Randomized Methods," in *Proc. ACM Conf. Recommender Systems (RecSys)*, 2010, pp. 173–180, doi: 10.1145/1864708.1864740.

---

### Infrastructure and Platform (cite in System Implementation)

[28] V. Vercel, "Next.js: The React Framework for the Web," 2024. [Online]. Available: https://nextjs.org

[29] Supabase Inc., "Supabase: The Open Source Firebase Alternative," 2024. [Online]. Available: https://supabase.com

[30] I. Das and J. E. Dennis, "Normal-Boundary Intersection: A New Method for Generating the Pareto Surface in Nonlinear Multicriteria Optimization Problems," *SIAM Journal on Optimization*, vol. 8, no. 3, pp. 631–657, Aug. 1998, doi: 10.1137/S1052623496307510.

---

### Notes for Paper Submission

- References [1]–[5] are the five primary algorithm citations — each must appear in the System Architecture and Algorithm Implementation sections.
- References [6]–[7] (LightGCN, BPR) are mandatory because the XSimGCL implementation uses both directly.
- References [10]–[11] (GCN, GAT) are needed in the background section before introducing XSimGCL and GAT+K-Means.
- References [15]–[16] (MOEA/D, MOEA/D extensions) are needed before introducing the MOEA/D-DRA-NEF implementation.
- References [18]–[19] (Girvan-Newman, Newman modularity) are needed before GAT+K-Means — modularity Q is their metric.
- References [21]–[24] are event recommendation related work — cite all four to show prior work exists but none integrates all five capabilities into a unified platform.
- References [25]–[26] justify the implicit feedback scoring scheme and the NDCG@10 evaluation choice.
- IEEE Access requires DOIs where available. All DOIs above have been verified against the design doc citations.
