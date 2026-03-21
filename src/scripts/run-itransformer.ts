import { createClient } from "@supabase/supabase-js";
import { iTransformer } from "../lib/algorithms/itransformer/index";
import { mae, rmse } from "../lib/algorithms/shared/evaluation";
import fs from "fs";

// To do ablation properly, we would normally patch forecast.ts dynamically.
// However, since we are fetching from DB, we will just fetch the 5 most booked events
// and run the models, calculating MAE & RMSE entirely in-memory!

async function run() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(url, key);

  // 1. Get top 5 events with longest booking histories
  const { data: bookings } = await supabase.from("bookings").select("event_id, created_at").eq("status", "confirmed").order("created_at");
  const eventBookingCount = new Map<string, number>();
  for (const b of (bookings || [])) {
    eventBookingCount.set(b.event_id, (eventBookingCount.get(b.event_id) || 0) + 1);
  }
  const topEvents = [...eventBookingCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);

  // Evaluator helper
  async function evaluateVariant(variantName: string) {
    const actuals: number[] = [];
    const preds: number[] = [];

    const forecaster = new iTransformer({ horizon: 7 });

    for (const eventId of topEvents) {
      const forecastResult = await forecaster.execute({ eventId, horizon: 7, supabaseClient: supabase });
      
      // Compare against actual bookings for the next 7 days
      // Wait, forecastResult.trend gives day 1 to 7 relative to TODAY.
      // We shift the evaluation window back 7 days so we can test against actual booked data
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      today.setDate(today.getDate() - 7);

      const eventBookings = (bookings || []).filter(b => b.event_id === eventId);
      for (let i = 0; i < forecastResult.trend.length; i++) {
        const targetDate = new Date(today);
        targetDate.setDate(targetDate.getDate() + i);
        const targetDateStr = targetDate.toISOString().split("T")[0];

        // How many valid bookings actually landed ON that target date?
        const actual = eventBookings.filter(b => b.created_at.startsWith(targetDateStr)).length;
        
        actuals.push(actual);
        preds.push(Number(forecastResult.trend[i]));
      }
    }

    const meanAbsErr = mae(actuals, preds);
    const rootMeanSqErr = rmse(actuals, preds);
    console.log(`${variantName}: MAE = ${meanAbsErr.toFixed(4)}, RMSE = ${rootMeanSqErr.toFixed(4)}`);
    return { mae: meanAbsErr, rmse: rootMeanSqErr };
  }

  // We rely on external file patching to run this script 3 times.
  // We will just run it once per invocation, and output to a JSON.
  const metrics = await evaluateVariant("Current Config");
  fs.writeFileSync("itransformer-results.json", JSON.stringify(metrics, null, 2));
}

run().catch(console.error);
