// src/app/api/algorithms/communities/route.ts
// Community detection endpoint
//
// GET  /api/algorithms/communities
//      → runs GAT+K-Means on all upcoming public events
//      → returns all communities with their event ID lists
//
// GET  /api/algorithms/communities?eventId=xxx
//      → returns the community this event belongs to
//      → returns similar events (other members of the same community)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { GATKMeans } from "@/lib/algorithms/gat-kmeans";
import type { EventCommunity } from "@/lib/algorithms/shared/types";

// Cache TTL: communities are stable — recompute every 30 minutes
const CACHE_TTL_MS = 30 * 60 * 1000;

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const supabase = createClient(url, key, {
      global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
    });

    // ── Parse query params ────────────────────────────────────────────────────
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");

    // ── Check cache in event_communities table ────────────────────────────────
    const { data: cachedCommunities } = await supabase
      .from("event_communities")
      .select("community_id, label, event_ids, size, density, modularity, characteristics, created_at")
      .gte("created_at", new Date(Date.now() - CACHE_TTL_MS).toISOString())
      .order("created_at", { ascending: false });

    let communities: EventCommunity[] = [];

    if (cachedCommunities && cachedCommunities.length > 0) {
      // Deserialise from DB shape
      communities = cachedCommunities.map((row) => ({
        communityId: row.community_id,
        label: row.label,
        eventIds: row.event_ids ?? [],
        size: row.size,
        density: row.density,
        modularity: row.modularity,
        characteristics: row.characteristics ?? [],
      }));

      logger.info(`[Communities] Returning ${communities.length} cached communities`);
    } else {
      logger.info("[Communities] Cache miss in GET — call POST to generate");
      return NextResponse.json({
        success: true,
        communities: [],
        numCommunities: 0,
        executionTimeMs: Date.now() - startTime,
        message: "Cache empty. Trigger computation via POST."
      });
    }

    // ── Filter by eventId if provided ─────────────────────────────────────────
    if (eventId) {
      const eventCommunity = communities.find((c) =>
        c.eventIds.includes(eventId)
      );

      if (!eventCommunity) {
        return NextResponse.json({
          success: true,
          community: null,
          similarEventIds: [],
          executionTimeMs: Date.now() - startTime,
        });
      }

      const similarEventIds = eventCommunity.eventIds
        .filter((id) => id !== eventId)
        .slice(0, 6);

      return NextResponse.json({
        success: true,
        community: eventCommunity,
        similarEventIds,
        executionTimeMs: Date.now() - startTime,
      });
    }

    // ── Return all communities ────────────────────────────────────────────────
    return NextResponse.json({
      success: true,
      communities,
      numCommunities: communities.length,
      executionTimeMs: Date.now() - startTime,
    });
  } catch (err: unknown) {
    logger.error("[Communities] Error:", err);
    return NextResponse.json(
      {
        error: "Failed to detect communities",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const supabase = createClient(url, key, {
      global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
    });

    // ── Check for optimistic lock ─────────────────────────────────────────────
    const { data: lockRow } = await supabase
      .from("algorithm_results")
      .select("created_at")
      .eq("algorithm_type", "gat-kmeans-lock")
      .gte("created_at", new Date(Date.now() - 60 * 1000).toISOString())
      .maybeSingle();

    if (lockRow) {
      logger.info("[Communities] Optimistic lock found. Another process is running GAT+K-Means.");
      return NextResponse.json({
        success: true,
        message: "Computation already in progress. Try again shortly.",
        communities: [],
        numCommunities: 0,
        executionTimeMs: Date.now() - startTime,
      }, { status: 202 });
    }

    // Acquire lock
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("algorithm_results").insert({
      algorithm_type: "gat-kmeans-lock",
      user_id: user?.id,
      input_data: {},
      output_data: {},
      execution_time_ms: 0,
      version: "1.0.0",
      expires_at: new Date(Date.now() + 60 * 1000).toISOString(),
    });

    // ── Run GAT+K-Means ───────────────────────────────────────────────────
    logger.info("[Communities] Running GAT+K-Means from POST request");

    // Read ablation flag from body (defaults to true = geographic decay ON)
    let geographicDecay = true;
    try {
      const body = await request.json();
      if (typeof body?.geographicDecay === "boolean") {
        geographicDecay = body.geographicDecay;
      }
    } catch {
      // No body or non-JSON body — use default
    }

    const algo = new GATKMeans();

    // Fetch events to pass as input (validate() needs events list)
    const { data: events } = await supabase
      .from("events")
      .select("id, tags, venue_city")
      .eq("visibility_type", "public")
      .eq("event_status", "upcoming")
      .gte("start_date", new Date().toISOString().split("T")[0])
      .limit(300);

    const eventInput = (events ?? []).map((e) => ({
      id: e.id,
      tags: Array.isArray(e.tags) ? e.tags : [],
      venueCity: e.venue_city ?? null,
      attendeeIds: [],
    }));

    if (eventInput.length === 0) {
      return NextResponse.json({
        success: true,
        communities: [],
        numCommunities: 0,
        executionTimeMs: Date.now() - startTime,
      });
    }

    const result = await algo.execute({
      events: eventInput,
      kRange: [4, Math.max(4, Math.min(10, Math.ceil(eventInput.length / 3)))],
      geographicDecay,
    });

    const communities = result.communities;

    // ── Persist to event_communities ──────────────────────────────────────
    if (communities.length > 0) {
      // Clear stale rows first
      await supabase
        .from("event_communities")
        .delete()
        .lt("created_at", new Date(Date.now() - CACHE_TTL_MS).toISOString());

      await supabase.from("event_communities").insert(
        communities.map((c) => ({
          community_id: c.communityId,
          label: c.label,
          event_ids: c.eventIds,
          size: c.size,
          density: c.density,
          modularity: c.modularity,
          characteristics: c.characteristics,
        }))
      );

      // Log to algorithm_results for paper (this implicitly replaces the lock if we delete it or we just add a new row)
      await supabase.from("algorithm_results").delete().eq("algorithm_type", "gat-kmeans-lock");
      
      await supabase.from("algorithm_results").insert({
        algorithm_type: "gat-kmeans",
        user_id: user?.id,
        input_data: { numEvents: eventInput.length, geographicDecay },
        output_data: {
          numCommunities: communities.length,
          modularity: result.modularity,
          silhouetteScore: result.silhouette ?? 0,
          singletonCount: (result as { singletonCount?: number }).singletonCount ?? 0,
          geographicDecay,
        },
        execution_time_ms: result.metrics.executionTimeMs,
        version: "1.0.0",
        expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
      });
    }

    logger.info(
      `[Communities] Detected ${communities.length} communities in ${Date.now() - startTime}ms`
    );

    return NextResponse.json({
      success: true,
      communities,
      numCommunities: communities.length,
      silhouetteScore: result.silhouette ?? 0,
      singletonCount: (result as { singletonCount?: number }).singletonCount ?? 0,
      executionTimeMs: Date.now() - startTime,
    });
  } catch (err: unknown) {
    logger.error("[Communities POST] Error:", err);
    return NextResponse.json(
      {
        error: "Failed to detect communities",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
