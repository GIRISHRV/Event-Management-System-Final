// src/lib/algorithms/shared/types.ts
// Base interfaces for all 5 algorithm implementations

import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Base Interface ────────────────────────────────────────────────────────────

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface AlgorithmMetrics {
  executionTimeMs: number;
  inputSize: number;
  outputSize: number;
  version: string;
  timestamp: Date;
}

export interface AlgorithmBase<TInput, TOutput> {
  name: string;
  version: string;
  execute(input: TInput): Promise<TOutput>;
  validate(input: TInput): ValidationResult;
  getMetrics(): AlgorithmMetrics;
}

// ─── Algorithm Type Registry ───────────────────────────────────────────────────

export type AlgorithmType =
  | "xsimgcl"           // XSimGCL recommendations (IEEE TKDE 2024)
  | "gnn-cf"            // GNN Cross-Domain CF cold start (IEEE 2024)
  | "itransformer"      // iTransformer forecasting (ICLR 2024)
  | "moea-d"            // MOEA/D-DRA-NEF budget optimizer (IEEE 2025)
  | "gat-kmeans";       // GAT + K-Means community detection (IEEE 2024)

// ─── Shared DB Result Type ─────────────────────────────────────────────────────

export interface AlgorithmResult {
  id?: string;
  userId?: string;
  algorithmType: AlgorithmType;
  inputData: Record<string, unknown>;
  outputData: Record<string, unknown>;
  executionTimeMs: number;
  version: string;
  createdAt?: string;
  expiresAt?: string;
}

// ─── Interaction / Graph Types ─────────────────────────────────────────────────

export type InteractionType = "view" | "favorite" | "rsvp" | "confirmed";

export const IMPLICIT_SCORES: Record<InteractionType, number> = {
  view: 0.3,
  favorite: 0.7,
  rsvp: 0.9,
  confirmed: 1.0,
};

export interface UserInteraction {
  userId: string;
  eventId: string;
  interactionType: InteractionType;
  implicitScore: number;
  createdAt: string;
}

// ─── Recommendation Types ──────────────────────────────────────────────────────

export interface RecommendationInput {
  userId: string;
  limit?: number;               // default 6
  excludeEventIds?: string[];   // already seen / booked
  /** Authenticated Supabase client from the API route — required for RLS. */
  supabaseClient: SupabaseClient;
}

export interface RecommendedEvent {
  eventId: string;
  score: number;                // 0–1 affinity score
  rank: number;
  algorithm: AlgorithmType;     // which algo produced this
}

export interface RecommendationOutput {
  recommendations: RecommendedEvent[];
  coldStart: boolean;           // true if GNN-CF was used instead of XSimGCL
  metrics: AlgorithmMetrics;
}

// ─── Forecast Types ────────────────────────────────────────────────────────────

export interface ForecastInput {
  eventId: string;
  horizon: 7 | 14;              // days ahead
  confidenceLevel?: number;     // default 0.95
}

export interface AttendancePrediction {
  date: string;                 // YYYY-MM-DD
  predictedAttendance: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
}

export interface ForecastOutput {
  eventId: string;
  predictions: AttendancePrediction[];
  trend: "increasing" | "decreasing" | "stable";
  recommendedCapacity: number;
  metrics: AlgorithmMetrics;
}

// ─── Budget Optimizer Types ────────────────────────────────────────────────────

export interface VendorCandidate {
  id: string;
  vendorId: string;
  serviceName: string;
  category: string;
  baseCost: number;
  qualityScore: number;         // 0–100 composite
  rating: number;               // 0–5
}

export interface BudgetOptimizerInput {
  eventId: string;
  budget: number;
  requiredCategories: string[];
  vendors: VendorCandidate[];
  objectiveWeights?: {
    cost: number;               // default 0.33
    quality: number;            // default 0.33
    diversity: number;          // default 0.34
  };
}

export interface VendorBundle {
  label: "Budget Pick" | "Balanced" | "Premium" | string;
  vendors: VendorCandidate[];
  totalCost: number;
  totalQuality: number;
  categoryDiversity: number;   // Shannon entropy
  improvementOverGreedy: number; // percentage
}

export interface BudgetOptimizerOutput {
  bundles: VendorBundle[];      // 3–5 Pareto-optimal bundles
  paretoSize: number;
  hypervolume?: number;          // HV indicator for the Pareto front
  metrics: AlgorithmMetrics;
}

// ─── Community Detection Types ─────────────────────────────────────────────────

export interface CommunityDetectionInput {
  events: Array<{
    id: string;
    tags: string[];
    venueCity: string | null;
    attendeeIds: string[];
  }>;
  similarityThreshold?: number; // default 0.1
  kRange?: [number, number];    // default [5, 12]
  /** When false, haversine-weighted geographic decay is disabled (ablation). */
  geographicDecay?: boolean;    // default true
}

export interface EventCommunity {
  communityId: number;
  label: string;
  eventIds: string[];
  size: number;
  density: number;
  modularity: number;
  characteristics: string[];
}

export interface CommunityDetectionOutput {
  communities: EventCommunity[];
  modularity: number;           // overall graph modularity score
  silhouette?: number;          // Silhouette coefficient [-1, 1]
  numCommunities: number;
  singletonCount?: number;      // communities with size === 1 (filtered out)
  metrics: AlgorithmMetrics;
}
