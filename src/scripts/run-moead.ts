import { createClient } from "@supabase/supabase-js";
import { MOEAD } from "../lib/algorithms/moea-d/index";
import { hypervolume2D } from "../lib/algorithms/shared/evaluation";
import fs from "fs";

async function run() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(url, key, { global: { headers: { "ngrok-skip-browser-warning": "true" } } });

  const budget = 50000;
  
  // 1. Fetch random event
  const { data: events } = await supabase.from("events").select("id").limit(1);
  if (!events || events.length === 0) return;
  const eventId = events[0].id;

  // 2. Fetch all vendors
  const { data: services } = await supabase
    .from("vendor_services")
    .select("id, vendor_id, service_name, category, base_price, quality_score, rating")
    .lte("base_price", budget)
    .order("base_price", { ascending: true });

  if (!services || services.length === 0) return;

  const realVendors = services.map(s => ({
    id: s.id,
    vendorId: s.vendor_id,
    serviceName: s.service_name,
    category: s.category,
    baseCost: s.base_price,
    qualityScore: s.quality_score ?? (s.rating != null ? s.rating * 20 : 50),
    rating: s.rating ?? 0,
  }));

  const nullQualityVendors = realVendors.map(v => ({
    ...v,
    qualityScore: 100 // Force all to perfect score so optimizer ignores quality diffs
  }));

  const refPoint: [number, number] = [budget * 1.1, 0];

  // Variant A: Greedy Baseline (Just pick cheapest)
  let greedyCost = 0;
  let greedyQualitySum = 0;
  let greedyCount = 0;
  for (const v of realVendors) {
    if (greedyCost + v.baseCost <= budget && greedyCount < 5) { // Assuming 5 categories needed
      greedyCost += v.baseCost;
      greedyQualitySum += v.qualityScore;
      greedyCount++;
    }
  }
  const greedyAvgQuality = greedyCount > 0 ? greedyQualitySum / greedyCount : 0;
  const greedyHv = hypervolume2D([[greedyCost, -greedyAvgQuality]], refPoint);

  // Variant B: Null Quality
  const moeadNull = new MOEAD();
  const resNull = await moeadNull.execute({
    eventId, budget, requiredCategories: [], vendors: nullQualityVendors
  });
  // Since it optimized over fake 100 quality, we must evaluate the selected bundles using REAL quality to be fair
  const nullBundlesRealMetrics = resNull.bundles.map(b => {
    let cost = 0;
    let qualitySum = 0;
    b.vendors.forEach(vid => {
      const real = realVendors.find(r => r.id === vid.id);
      cost += real?.baseCost || 0;
      qualitySum += real?.qualityScore || 0;
    });
    return [cost, -(qualitySum / b.vendors.length)] as [number, number];
  });
  const nullHv = hypervolume2D(nullBundlesRealMetrics, refPoint);

  // Variant C: Real Quality (Default)
  const moeadReal = new MOEAD();
  const resReal = await moeadReal.execute({
    eventId, budget, requiredCategories: [], vendors: realVendors
  });
  const realHv = resReal.hypervolume; // It calculates it natively using real quality

  const metrics = {
    variant_A_greedy: { hypervolume: parseFloat(greedyHv.toFixed(4)) },
    variant_B_null_quality: { hypervolume: parseFloat(nullHv.toFixed(4)) },
    variant_C_real_quality: { hypervolume: parseFloat((realHv ?? 0).toFixed(4)) }
  };

  console.log(metrics);
  fs.writeFileSync("moead-results.json", JSON.stringify(metrics, null, 2));
}

run().catch(console.error);
