// src/lib/algorithms/gat-kmeans/graph.ts
// Fetches events from Supabase and builds an event-event similarity graph
// for GAT community detection.
//
// Paper: GAT + K-Means for Event Community Detection, IEEE 2024
//        https://ieeexplore.ieee.org/document/10543468/
//
// Each node = one event
// Edge weight = weighted combo of tag Jaccard + attendee Jaccard + location match
// (reuses buildEventSimilarityGraph from shared/graph.ts)

import { supabase } from "@/services/supabase/client";
import {
  buildEventSimilarityGraph,
  type Graph,
  type EventNode,
} from "../shared/graph";

export interface EventForCommunity {
  id: string;
  event_name: string;
  tags: string[];
  venue_city: string | null;
  latitude: number | null;
  longitude: number | null;
  attendee_ids: string[];
}

export interface GraphBuildResult {
  graph: Graph;
  events: EventForCommunity[];
}

/**
 * Fetches all upcoming public events with their tags and attendee IDs,
 * then builds the event-event similarity graph used by GAT.
 *
 * @param limit         Max number of events to fetch
 * @param weights       Optional manual weight overrides
 * @param geographicDecay  When false, haversine distance weighting is disabled
 *                         (sets location weight to 0). Used for ablation studies.
 */
export async function buildEventCommunityGraph(
  limit = 300,
  weights?: { tag: number; attendee: number; location: number },
  geographicDecay = true
): Promise<GraphBuildResult> {
  // Fetch events
  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id, event_name, tags, venue_city, venue_latitude, venue_longitude")
    .eq("visibility_type", "public")
    .eq("event_status", "upcoming")
    .gte("start_date", new Date().toISOString().split("T")[0])
    .order("attendee_count", { ascending: false })
    .limit(limit);

  if (eventsError) {
    throw new Error(`[GAT-KMeans] Events fetch failed: ${eventsError.message}`);
  }

  const eventList = events ?? [];
  const eventIds = eventList.map((e) => e.id);

  // Fetch confirmed attendees per event (for attendee Jaccard similarity)
  const { data: bookings } = await supabase
    .from("bookings")
    .select("event_id, user_id")
    .eq("status", "confirmed")
    .in("event_id", eventIds);

  // Build attendee map: eventId → Set<userId>
  const attendeeMap = new Map<string, string[]>();
  for (const b of bookings ?? []) {
    if (!attendeeMap.has(b.event_id)) attendeeMap.set(b.event_id, []);
    attendeeMap.get(b.event_id)!.push(b.user_id);
  }

  const enrichedEvents: EventForCommunity[] = eventList.map((e) => ({
    id: e.id,
    event_name: e.event_name,
    tags: normaliseTags(e.tags),
    venue_city: e.venue_city ?? null,
    latitude: e.venue_latitude ?? null,
    longitude: e.venue_longitude ?? null,
    attendee_ids: attendeeMap.get(e.id) ?? [],
  }));

  // Build event-event similarity graph using shared utility.
  // When geographicDecay is disabled, location weight is zeroed for ablation.
  const effectiveWeights = geographicDecay
    ? weights
    : { tag: 0.6, attendee: 0.4, location: 0, ...(weights ?? {}) };

  const graphNodes: EventNode[] = enrichedEvents.map((e) => ({
    id: e.id,
    tags: e.tags,
    venueCity: e.venue_city,
    latitude: e.latitude,
    longitude: e.longitude,
    attendeeIds: e.attendee_ids,
  }));

  const graph = buildEventSimilarityGraph(graphNodes, 0.05, effectiveWeights);

  return { graph, events: enrichedEvents };
}

function normaliseTags(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return (raw as unknown[])
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.toLowerCase().trim())
      .filter(Boolean);
  }
  if (typeof raw === "string") {
    try {
      return normaliseTags(JSON.parse(raw));
    } catch {
      return [raw.toLowerCase().trim()].filter(Boolean);
    }
  }
  return [];
}
