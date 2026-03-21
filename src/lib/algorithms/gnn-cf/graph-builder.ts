// src/lib/algorithms/gnn-cf/graph-builder.ts
// Builds two bipartite interaction graphs for cross-domain cold-start CF
//
// Paper: "Cross-Domain Recommendation via Preference Propagation GraphNet"
//        IEEE Transactions, 2024 — https://ieeexplore.ieee.org/document/10452478
//
// Domain A — user ↔ event  (from bookings + user_interactions)
// Domain B — user ↔ vendor (from service_requests)
//
// Bridge: vendor.category tokens ↔ event.tags tokens
// A user who requested Photography/Music vendors is likely interested in
// events tagged with those categories — even with zero event interactions.
//
// IMPORTANT: Functions accept an authenticated SupabaseClient injected from the
// API route handler. Do NOT import the browser singleton here — it is anonymous
// and will be blocked by RLS on user_interactions, bookings, and service_requests.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildBipartiteGraph,
  type Graph,
  type InteractionRecord,
} from "../shared/graph";
import { IMPLICIT_SCORES } from "../shared/types";

// ─── Output Types ──────────────────────────────────────────────────────────────

export interface DomainGraph {
  graph: Graph;
  userIds: string[];
  itemIds: string[];           // eventIds (Domain A) or vendorIds (Domain B)
  interactionCount: number;
}

/** Candidate event with its tags for cross-domain scoring */
export interface CandidateEventFeatures {
  id: string;
  event_name: string;
  attendee_count: number;
  tags: string[];              // normalised lowercase tokens from event.tags JSONB
}

/** Vendor category signal extracted from Domain B */
export interface VendorSignal {
  vendorId: string;
  categories: string[];        // normalised lowercase category tokens
  weight: number;              // implicit score from interaction
}

// ─── Domain A: User ↔ Event ────────────────────────────────────────────────────

/**
 * Builds the user-event bipartite graph for a single cold-start user.
 * Sources: user_interactions (view/fav/rsvp) + bookings (rsvp/confirmed).
 * Cold-start users will have 0–2 edges here; that is expected.
 */
export async function buildDomainAGraph(
  userId: string,
  supabase: SupabaseClient
): Promise<DomainGraph> {
  const records: InteractionRecord[] = [];

  // Primary: user_interactions table
  const { data: interactions, error: intErr } = await supabase
    .from("user_interactions")
    .select("user_id, event_id, implicit_score")
    .eq("user_id", userId)
    .not("event_id", "is", null);

  if (intErr) {
    throw new Error(`[GNN-CF] Domain A interactions fetch failed: ${intErr.message}`);
  }

  for (const row of interactions ?? []) {
    records.push({
      userId: row.user_id,
      targetId: row.event_id,
      weight: row.implicit_score,
    });
  }

  // Supplement: bookings table
  const { data: bookings, error: bookErr } = await supabase
    .from("bookings")
    .select("user_id, event_id, status")
    .eq("user_id", userId);

  if (bookErr) {
    throw new Error(`[GNN-CF] Domain A bookings fetch failed: ${bookErr.message}`);
  }

  for (const b of bookings ?? []) {
    const type = b.status === "confirmed" ? "confirmed" : "rsvp";
    records.push({
      userId: b.user_id,
      targetId: b.event_id,
      weight: IMPLICIT_SCORES[type],
    });
  }

  // Deduplicate — keep max score per (user, event) pair
  const deduped = new Map<string, InteractionRecord>();
  for (const r of records) {
    const key = `${r.userId}:${r.targetId}`;
    const existing = deduped.get(key);
    if (!existing || r.weight > existing.weight) deduped.set(key, r);
  }

  const unique = [...deduped.values()];
  const eventIds = [...new Set(unique.map(r => r.targetId))];
  const graph = buildBipartiteGraph([userId], eventIds, unique, "event");

  return {
    graph,
    userIds: [userId],
    itemIds: eventIds,
    interactionCount: unique.length,
  };
}

// ─── Domain B: User ↔ Vendor ───────────────────────────────────────────────────

/**
 * Builds the user-vendor bipartite graph from service_requests.
 * Every service request = an implicit signal that the user cares about
 * that vendor's category (photography, music, catering, etc.).
 *
 * Status weight mapping:
 *   pending   → 0.4  (browsed and enquired)
 *   accepted  → 0.8  (actively engaged)
 *   completed → 1.0  (confirmed relationship)
 *   rejected  → 0.2  (shown intent, even if declined)
 */
export async function buildDomainBGraph(
  userId: string,
  supabase: SupabaseClient
): Promise<DomainGraph> {
  const STATUS_WEIGHTS: Record<string, number> = {
    pending: 0.4,
    accepted: 0.8,
    completed: 1.0,
    rejected: 0.2,
    cancelled: 0.1,
  };

  const { data: requests, error } = await supabase
    .from("service_requests")
    .select("vendor_id, status, vendor_services(category)")
    .eq("requester_id", userId);

  if (error) {
    throw new Error(`[GNN-CF] Domain B service_requests fetch failed: ${error.message}`);
  }

  const records: InteractionRecord[] = [];

  for (const req of requests ?? []) {
    if (!req.vendor_id) continue;
    const weight = STATUS_WEIGHTS[req.status] ?? 0.3;
    records.push({
      userId,
      targetId: req.vendor_id,
      weight,
    });
  }

  // Also pull vendor_view signals from user_interactions (#2)
  const { data: vendorViews } = await supabase
    .from("user_interactions")
    .select("vendor_service_id, implicit_score")
    .eq("user_id", userId)
    .eq("interaction_type", "vendor_view")
    .not("vendor_service_id", "is", null);

  if (vendorViews && vendorViews.length > 0) {
    // Resolve vendor_service_id → vendor_id
    const serviceIds = [...new Set(vendorViews.map(v => v.vendor_service_id).filter(Boolean))];
    const { data: services } = await supabase
      .from("vendor_services")
      .select("id, vendor_id")
      .in("id", serviceIds);

    const serviceToVendor = new Map((services ?? []).map(s => [s.id, s.vendor_id]));

    for (const vv of vendorViews) {
      const vendorId = serviceToVendor.get(vv.vendor_service_id);
      if (vendorId) {
        records.push({
          userId,
          targetId: vendorId,
          weight: vv.implicit_score ?? 0.2,
        });
      }
    }
  }

  // Deduplicate — keep max weight per (user, vendor) pair
  const deduped = new Map<string, InteractionRecord>();
  for (const r of records) {
    const key = `${r.userId}:${r.targetId}`;
    const existing = deduped.get(key);
    if (!existing || r.weight > existing.weight) deduped.set(key, r);
  }

  const unique = [...deduped.values()];
  const vendorIds = [...new Set(unique.map(r => r.targetId))];
  const graph = buildBipartiteGraph([userId], vendorIds, unique, "vendor");

  return {
    graph,
    userIds: [userId],
    itemIds: vendorIds,
    interactionCount: unique.length,
  };
}

// ─── Vendor Category Signal Extraction ────────────────────────────────────────

/**
 * Returns the set of normalised vendor category tokens that the user has
 * expressed interest in through their service_requests (Domain B).
 * Used as the cross-domain bridge signal.
 */
export async function extractVendorSignals(
  userId: string,
  supabase: SupabaseClient
): Promise<VendorSignal[]> {
  const STATUS_WEIGHTS: Record<string, number> = {
    pending: 0.4,
    accepted: 0.8,
    completed: 1.0,
    rejected: 0.2,
    cancelled: 0.1,
  };

  const { data: requests, error } = await supabase
    .from("service_requests")
    .select("vendor_id, status, vendor_services(category)")
    .eq("requester_id", userId);

  if (error) {
    throw new Error(`[GNN-CF] Vendor signal extraction failed: ${error.message}`);
  }

  const signals: VendorSignal[] = [];

  for (const req of requests ?? []) {
    if (!req.vendor_id) continue;

    const vendorServices = Array.isArray(req.vendor_services)
      ? req.vendor_services
      : req.vendor_services
        ? [req.vendor_services]
        : [];

    const categories = vendorServices
      .map((vs: { category?: string }) => vs.category ?? "")
      .filter(Boolean)
      .map((c: string) => c.toLowerCase().trim());

    if (categories.length === 0) continue;

    signals.push({
      vendorId: req.vendor_id,
      categories,
      weight: STATUS_WEIGHTS[req.status] ?? 0.3,
    });
  }

  return signals;
}

// ─── Candidate Event Fetcher with Features ────────────────────────────────────

/**
 * Fetches upcoming public events with their tag arrays.
 * Tags are normalised to lowercase tokens for cross-domain matching.
 */
export async function fetchCandidateEventsWithFeatures(
  excludeEventIds: string[],
  supabase: SupabaseClient
): Promise<CandidateEventFeatures[]> {
  const { data, error } = await supabase
    .from("events")
    .select("id, event_name, attendee_count, tags")
    .eq("visibility_type", "public")
    .eq("event_status", "upcoming")
    .gte("start_date", new Date().toISOString().split("T")[0])
    .order("attendee_count", { ascending: false })
    .limit(500);

  if (error) {
    throw new Error(`[GNN-CF] Candidate events fetch failed: ${error.message}`);
  }

  const excludeSet = new Set(excludeEventIds);

  return (data ?? [])
    .filter(e => !excludeSet.has(e.id))
    .map(e => ({
      id: e.id,
      event_name: e.event_name,
      attendee_count: e.attendee_count ?? 0,
      // tags can be string[], JSONB array, or null — normalise defensively
      tags: normaliseTags(e.tags),
    }));
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function normaliseTags(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .filter((t): t is string => typeof t === "string")
      .map(t => t.toLowerCase().trim())
      .filter(Boolean);
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return normaliseTags(parsed);
    } catch {
      return [raw.toLowerCase().trim()].filter(Boolean);
    }
  }
  return [];
}
