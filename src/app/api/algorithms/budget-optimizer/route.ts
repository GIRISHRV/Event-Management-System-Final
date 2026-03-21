// src/app/api/algorithms/budget-optimizer/route.ts
// Budget optimization endpoint — organizer only (admins can bypass for testing)
//
// POST /api/algorithms/budget-optimizer
// Body: { eventId?: string, budget: number, requiredCategories?: string[] }
//
// Fetches all vendor_services from the marketplace, runs MOEA/D-DRA-NEF,
// returns 3–5 Pareto-optimal vendor bundles.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { MOEAD } from "@/lib/algorithms/moea-d";
import type { VendorCandidate } from "@/lib/algorithms/shared/types";

// ─── Input Schema ──────────────────────────────────────────────────────────────

const BudgetOptimizerRequestSchema = z.object({
  // eventId is optional — admins can test with just a budget and no event
  eventId: z.string().uuid("eventId must be a valid UUID").optional(),
  budget: z.number().positive("budget must be positive"),
  requiredCategories: z.array(z.string()).optional().default([]),
});

// ─── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const supabase = createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    // ── Check if caller is admin ───────────────────────────────────────────────
    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const isAdmin = callerProfile?.role === "admin";

    // ── Validate body ─────────────────────────────────────────────────────────
    const body = await request.json();
    const parsed = BudgetOptimizerRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { eventId, budget, requiredCategories } = parsed.data;

    // ── Ownership check — skipped for admins and when no eventId provided ─────
    let resolvedBudget = budget;

    if (eventId) {
      const { data: event, error: eventError } = await supabase
        .from("events")
        .select("id, user_id, event_name, budget")
        .eq("id", eventId)
        .single();

      if (eventError || !event) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 });
      }

      if (event.user_id !== user.id && !isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      // Use the event's budget if none was provided explicitly, or override with passed budget
      if (event.budget && budget === 0) {
        resolvedBudget = event.budget;
      }
    } else if (!isAdmin) {
      // Non-admins must always provide an eventId
      return NextResponse.json(
        { error: "eventId is required" },
        { status: 400 }
      );
    }

    // ── Fetch vendor candidates from marketplace ───────────────────────────────
    const { data: services, error: servicesError } = await supabase
      .from("vendor_services")
      .select("id, vendor_id, service_name, category, base_price, quality_score, rating")
      .lte("base_price", resolvedBudget)
      .order("base_price", { ascending: true })
      .limit(200);

    if (servicesError) {
      return NextResponse.json(
        { error: "Failed to fetch vendor services" },
        { status: 500 }
      );
    }

    if (!services || services.length === 0) {
      return NextResponse.json({
        success: true,
        bundles: [],
        paretoSize: 0,
        message: "No vendors available within budget — add vendor services to the marketplace first.",
        executionTimeMs: Date.now() - startTime,
      });
    }

    // ── Map to VendorCandidate ─────────────────────────────────────────────────
    const vendors: VendorCandidate[] = services.map(s => ({
      id: s.id,
      vendorId: s.vendor_id,
      serviceName: s.service_name,
      category: s.category,
      baseCost: s.base_price,
      qualityScore: s.quality_score ?? (s.rating != null ? s.rating * 20 : 50),
      rating: s.rating ?? 0,
    }));

    logger.info(
      `[BudgetOptimizer] eventId=${eventId ?? "admin-test"}, budget=₹${resolvedBudget}, vendors=${vendors.length}`
    );

    // ── Run MOEA/D-DRA-NEF ────────────────────────────────────────────────────
    const algo = new MOEAD();
    const result = await algo.execute({
      eventId: eventId ?? "admin-test",
      budget: resolvedBudget,
      requiredCategories,
      vendors,
    });

    // ── Log to algorithm_results for paper ────────────────────────────────────
    await supabase.from("algorithm_results").insert({
      user_id: user.id,
      algorithm_type: "moea-d",
      input_data: { eventId: eventId ?? "admin-test", budget: resolvedBudget, vendorCount: vendors.length },
      output_data: {
        paretoSize: result.paretoSize,
        bundleCount: result.bundles.length,
        labels: result.bundles.map(b => b.label),
      },
      execution_time_ms: result.metrics.executionTimeMs,
      version: "1.0.0",
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });

    logger.info(
      `[BudgetOptimizer] Done in ${Date.now() - startTime}ms, ` +
      `paretoSize=${result.paretoSize}, bundles=${result.bundles.length}`
    );

    return NextResponse.json({
      success: true,
      bundles: result.bundles,
      paretoSize: result.paretoSize,
      executionTimeMs: result.metrics.executionTimeMs,
    });
  } catch (err: unknown) {
    logger.error("[BudgetOptimizer] Error:", err);
    return NextResponse.json(
      {
        error: "Failed to optimise budget",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}