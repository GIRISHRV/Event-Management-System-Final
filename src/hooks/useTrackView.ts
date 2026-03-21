// src/hooks/useTrackView.ts
// Writes a 'view' interaction to user_interactions and recently_viewed
// when an authenticated user opens an event page.
// This feeds XSimGCL and GNN-CF with implicit signal data.

import { useEffect } from "react";
import { supabase } from "@/services/supabase/client";
import { logger } from "@/lib/logger";

export function useTrackView(eventId: string | undefined, userId: string | undefined) {
  useEffect(() => {
    if (!eventId || !userId) return;

    const track = async () => {
      try {
        // 1. Write to user_interactions (feeds XSimGCL graph)
        await supabase.from("user_interactions").upsert(
          {
            user_id: userId,
            event_id: eventId,
            interaction_type: "view",
            implicit_score: 0.3,
          },
          {
            // Update timestamp if row already exists so we get recency signal
            onConflict: "user_id,event_id,interaction_type",
            ignoreDuplicates: false,
          }
        );

        // Clear recommendation algorithm cache on new interaction
        await supabase
          .from("algorithm_results")
          .delete()
          .eq("user_id", userId)
          .in("algorithm_type", ["xsimgcl", "gnn-cf"]);

        // 2. Write to recently_viewed (existing table — keeps event detail page working)
        await supabase.from("recently_viewed").upsert(
          {
            user_id: userId,
            event_id: eventId,
            viewed_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,event_id",
            ignoreDuplicates: false,
          }
        );
      } catch (err: unknown) {
        // Non-blocking — a tracking failure should never break the page
        logger.error("[useTrackView] Failed to track view:", err instanceof Error ? err.message : err);
      }
    };

    track();
    // Only run once per (eventId, userId) mount — not on every re-render
  }, [eventId, userId]);
}
