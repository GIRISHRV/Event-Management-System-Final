// src/lib/algorithms/xsimgcl/graph-builder.ts
// Fetches user-event interactions from Supabase and builds the bipartite graph
// Data sources: user_interactions (primary) + bookings (supplement/fallback)
//
// IMPORTANT: Functions accept an authenticated SupabaseClient injected from the
// API route handler. Do NOT import the browser singleton here — it is anonymous
// and will be blocked by RLS on user_interactions and bookings.
//
// NOTE ON LEAKAGE FIX: This file does not need changes. The leakage was:
//   1. simulate-ai writing synthetic user_interactions rows pointing at the
//      same events used in evaluation (fixed in simulate-ai/route.ts)
//   2. fetchCandidateEvents receiving [] instead of interactedIds, allowing
//      training-set events into the candidate pool (fixed in index.ts)
//
// buildUserGraph correctly reads from user_interactions as primary source
// and supplements with bookings. This is the right design.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildBipartiteGraph,
  type Graph,
  type InteractionRecord,
} from "../shared/graph";
import { IMPLICIT_SCORES } from "../shared/types";

export interface GraphBuildResult {
  graph: Graph;
  userIds: string[];
  eventIds: string[];
  interactionCount: number;
}

// Build the interaction graph for a single user (inference time)
// cutoffDate: when provided (eval mode), only bookings BEFORE this date
// are used as training signal. This prevents test-window bookings from
// appearing in interactedIds and being excluded from the candidate pool.
export async function buildUserGraph(
  userId: string,
  supabase: SupabaseClient,
  cutoffDate?: string  // ISO string e.g. "2026-02-23T04:18:36.278Z"
): Promise<GraphBuildResult> {
  // Primary source: user_interactions table
  // user_interactions only contains training-window bookings (synced by simulate)
  // so no cutoff filter needed here
  const { data: interactions, error } = await supabase
    .from("user_interactions")
    .select("user_id, event_id, interaction_type, implicit_score")
    .eq("user_id", userId)
    .not("event_id", "is", null);

  if (error) throw new Error(`[XSimGCL] Interactions fetch failed: ${error.message}`);

  const records: InteractionRecord[] = (interactions ?? []).map(row => ({
    userId: row.user_id,
    targetId: row.event_id,
    weight: row.implicit_score,
  }));

  // Supplement with bookings directly as fallback.
  // CRITICAL: when cutoffDate is provided, only include bookings BEFORE the
  // cutoff. Test-window bookings must NOT appear in the training graph or they
  // get added to interactedIds and excluded from the candidate pool, making
  // it impossible to recommend them even though they're the ground truth.
  let bookingsQuery = supabase
    .from("bookings")
    .select("user_id, event_id, status, created_at")
    .eq("user_id", userId);

  if (cutoffDate) {
    bookingsQuery = bookingsQuery.lte("created_at", cutoffDate);
  }

  const { data: bookings } = await bookingsQuery;

  for (const b of bookings ?? []) {
    const type =
      b.status === "confirmed" ? "confirmed"
        : b.status === "waitlist" ? "rsvp"
          : "rsvp";
    records.push({
      userId: b.user_id,
      targetId: b.event_id,
      weight: IMPLICIT_SCORES[type as keyof typeof IMPLICIT_SCORES],
    });
  }

  // Deduplicate — keep highest score per (user, event) pair
  const deduped = new Map<string, InteractionRecord>();
  for (const r of records) {
    const key = `${r.userId}:${r.targetId}`;
    const existing = deduped.get(key);
    if (!existing || r.weight > existing.weight) deduped.set(key, r);
  }

  const uniqueRecords = [...deduped.values()];
  const eventIds = [...new Set(uniqueRecords.map(r => r.targetId))];
  const graph = buildBipartiteGraph([userId], eventIds, uniqueRecords, "event");

  return { graph, userIds: [userId], eventIds, interactionCount: uniqueRecords.length };
}

// Build the full training graph across all users and events (training pass)
export async function buildFullGraph(
  supabase: SupabaseClient,
  cutoffDate?: string
): Promise<GraphBuildResult> {
  const { data: interactions, error } = await supabase
    .from("user_interactions")
    .select("user_id, event_id, interaction_type, implicit_score")
    .not("event_id", "is", null)
    .limit(50000);

  if (error) throw new Error(`[XSimGCL] Full graph fetch failed: ${error.message}`);

  let bookingsQuery = supabase
    .from("bookings")
    .select("user_id, event_id, status, created_at")
    .limit(50000);

  if (cutoffDate) {
    bookingsQuery = bookingsQuery.lte("created_at", cutoffDate);
  }

  const { data: bookings } = await bookingsQuery;

  const records: InteractionRecord[] = [];

  for (const row of interactions ?? []) {
    records.push({ userId: row.user_id, targetId: row.event_id, weight: row.implicit_score });
  }
  for (const b of bookings ?? []) {
    const type = b.status === "confirmed" ? "confirmed" : "rsvp";
    records.push({ userId: b.user_id, targetId: b.event_id, weight: IMPLICIT_SCORES[type] });
  }

  const deduped = new Map<string, InteractionRecord>();
  for (const r of records) {
    const key = `${r.userId}:${r.targetId}`;
    const existing = deduped.get(key);
    if (!existing || r.weight > existing.weight) deduped.set(key, r);
  }

  const uniqueRecords = [...deduped.values()];
  const userIds = [...new Set(uniqueRecords.map(r => r.userId))];
  const eventIds = [...new Set(uniqueRecords.map(r => r.targetId))];
  const graph = buildBipartiteGraph(userIds, eventIds, uniqueRecords, "event");

  return { graph, userIds, eventIds, interactionCount: uniqueRecords.length };
}

// Fetch candidate events for recommendation.
// Excludes events the user has already interacted with so they cannot
// appear in recommendations or inflate NDCG during evaluation.
export async function fetchCandidateEvents(
  excludeEventIds: string[],
  supabase: SupabaseClient,
  options: { upcomingOnly?: boolean } = {}
): Promise<Array<{ id: string; event_name: string }>> {
  // upcomingOnly = true  → production use (only show future events to users)
  // upcomingOnly = false → evaluation use (all events including past ones,
  //                        so ground truth events can appear in recommendations)
  const upcomingOnly = options.upcomingOnly ?? true;

  let query = supabase
    .from("events")
    .select("id, event_name")
    .eq("visibility_type", "public");

  if (upcomingOnly) {
    query = query
      .eq("event_status", "upcoming")
      .gte("start_date", new Date().toISOString().split("T")[0]);
  }

  const { data, error } = await query
    .order("start_date", { ascending: true })
    .limit(500);

  if (error) throw new Error(`[XSimGCL] Candidate fetch failed: ${error.message}`);

  const excludeSet = new Set(excludeEventIds);
  return (data ?? []).filter((e: { id: string; event_name: string }) => !excludeSet.has(e.id));
}