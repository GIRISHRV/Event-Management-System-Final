// POST /api/admin/backfill-quality
// Computes proxy quality scores for all vendor_services from real service_requests data.
// quality_score = 0.5 * acceptanceRate + 0.3 * responseSpeed + 0.2 * normalisedValue
// This feeds MOEA/D with real trade-off signals instead of null/default values.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
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

    // Auth check — admin only
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    if (user.app_metadata?.role !== "admin") {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (!profile || profile.role !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // 1. Fetch all vendor services
    const { data: services } = await supabase
      .from("vendor_services")
      .select("id, vendor_id");

    if (!services || services.length === 0) {
      return NextResponse.json({ success: true, message: "No vendor services found", updated: 0 });
    }

    // 2. Fetch all service requests
    const { data: requests } = await supabase
      .from("service_requests")
      .select("service_id, vendor_id, status, created_at, updated_at");

    const requestsByVendor = new Map<string, typeof requests>();
    for (const req of requests ?? []) {
      const key = req.vendor_id;
      if (!key) continue;
      if (!requestsByVendor.has(key)) requestsByVendor.set(key, []);
      requestsByVendor.get(key)!.push(req);
    }

    // 3. Compute metrics per vendor
    const vendorMetrics: Array<{
      vendorId: string;
      acceptanceRate: number;
      avgResponseHours: number;
      avgValue: number; // placeholder — no quoted_price column, use count as proxy
    }> = [];

    for (const [vendorId, reqs] of requestsByVendor) {
      if (!reqs || reqs.length === 0) continue;

      const total = reqs.length;
      const accepted = reqs.filter(r => r.status === "accepted" || r.status === "completed").length;
      const acceptanceRate = accepted / total;

      // Response speed: hours between created_at and updated_at for accepted requests
      let totalHours = 0;
      let responseCount = 0;
      for (const r of reqs) {
        if (r.status === "accepted" || r.status === "completed") {
          const created = new Date(r.created_at).getTime();
          const updated = new Date(r.updated_at).getTime();
          const hours = Math.max(0, (updated - created) / (1000 * 60 * 60));
          if (hours < 720) { // cap at 30 days to exclude stale data
            totalHours += hours;
            responseCount++;
          }
        }
      }

      const avgResponseHours = responseCount > 0 ? totalHours / responseCount : 168; // default 1 week

      vendorMetrics.push({
        vendorId,
        acceptanceRate,
        avgResponseHours,
        avgValue: total, // use request volume as a proxy signal
      });
    }

    if (vendorMetrics.length === 0) {
      return NextResponse.json({ success: true, message: "No service requests to compute from", updated: 0 });
    }

    // 4. Normalise each metric to [0, 1] across all vendors
    const maxHours = Math.max(...vendorMetrics.map(v => v.avgResponseHours), 1);
    const maxValue = Math.max(...vendorMetrics.map(v => v.avgValue), 1);

    // 5. Compute quality_score and update
    let updated = 0;
    for (const vm of vendorMetrics) {
      const normResponseSpeed = 1 - (vm.avgResponseHours / maxHours); // faster = higher
      const normValue = vm.avgValue / maxValue;

      const qualityScore = parseFloat(
        (0.5 * vm.acceptanceRate + 0.3 * normResponseSpeed + 0.2 * normValue).toFixed(4)
      );

      // Update all services for this vendor
      const { error: updateErr } = await supabase
        .from("vendor_services")
        .update({ quality_score: qualityScore })
        .eq("vendor_id", vm.vendorId);

      if (!updateErr) updated++;
    }

    return NextResponse.json({
      success: true,
      vendorsProcessed: vendorMetrics.length,
      servicesUpdated: updated,
      sampleScores: vendorMetrics.slice(0, 5).map(vm => ({
        vendorId: vm.vendorId.slice(0, 8),
        acceptanceRate: vm.acceptanceRate.toFixed(2),
        avgResponseHours: vm.avgResponseHours.toFixed(1),
        qualityScore: (0.5 * vm.acceptanceRate + 0.3 * (1 - vm.avgResponseHours / maxHours) + 0.2 * vm.avgValue / maxValue).toFixed(4),
      })),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Backfill failed" },
      { status: 500 }
    );
  }
}
