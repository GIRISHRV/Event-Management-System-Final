"use client";

// src/components/vendor/VendorRatingsPanel.tsx
// Shows all incoming ratings received by the currently logged-in vendor.

import useSWR from "swr";
import { useAuth } from "@/context/AuthContext";
import { Star, MessageSquare } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Badge } from "@/components/ui/badge";

interface RatingRow {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  vendor_services: { service_name: string; category: string } | null;
  events: { event_name: string } | null;
  rater: { full_name: string } | null;
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={14}
          className={n <= rating ? "fill-amber-400 stroke-amber-400" : "stroke-[var(--color-border)] fill-transparent"}
        />
      ))}
    </div>
  );
}

export function VendorRatingsPanel() {
  const { session } = useAuth();

  const { data, isLoading } = useSWR(
    session?.user?.id ? ["vendor-ratings", session.user.id] : null,
    async () => {
      const res = await fetch(`/api/vendor-ratings?vendorId=${session!.user!.id}`, {
        headers: { Authorization: `Bearer ${session!.access_token}` },
      });
      const json = await res.json();
      return json.ratings as RatingRow[];
    },
    { revalidateOnFocus: false }
  );

  const ratings = data ?? [];
  const avgRating = ratings.length > 0
    ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length
    : 0;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary strip */}
      <div className="flex items-center gap-6 p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 to-orange-500/5 border border-amber-400/20">
        <div className="flex flex-col items-center">
          <p className="text-4xl font-black text-amber-400">{avgRating.toFixed(1)}</p>
          <StarDisplay rating={Math.round(avgRating)} />
          <p className="text-[10px] text-[var(--color-text-tertiary)] mt-1 uppercase tracking-wider">Avg Rating</p>
        </div>
        <div className="h-12 w-px bg-[var(--color-border)]" />
        <div className="flex flex-col items-center">
          <p className="text-4xl font-black text-[var(--color-text-primary)]">{ratings.length}</p>
          <p className="text-[10px] text-[var(--color-text-tertiary)] mt-1 uppercase tracking-wider">Total Reviews</p>
        </div>
        <div className="ml-auto text-xs text-[var(--color-text-tertiary)] italic max-w-48 text-right">
          Your average rating updates the Smart Budget Optimizer for event planners.
        </div>
      </div>

      {/* Rating cards */}
      {ratings.length === 0 ? (
        <div className="flex flex-col items-center py-16 border border-dashed border-[var(--color-border)] rounded-2xl text-[var(--color-text-tertiary)]">
          <Star size={40} className="opacity-20 mb-3" />
          <p className="font-semibold">No ratings yet</p>
          <p className="text-sm mt-1 opacity-70">Completed service requests will earn you ratings from organizers.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ratings.map((r) => {
            const svc = Array.isArray(r.vendor_services) ? r.vendor_services[0] : r.vendor_services;
            const evt = Array.isArray(r.events) ? r.events[0] : r.events;
            const rater = Array.isArray(r.rater) ? r.rater[0] : r.rater;
            return (
              <Card key={r.id} className="p-4 border-[var(--color-border)] bg-[var(--color-surface)]">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <StarDisplay rating={r.rating} />
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 capitalize">
                        {svc?.category ?? "Service"}
                      </Badge>
                    </div>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {svc?.service_name ?? "Unknown Service"}
                    </p>
                    {r.comment && (
                      <p className="text-sm text-[var(--color-text-secondary)] flex gap-2 items-start">
                        <MessageSquare size={13} className="mt-0.5 shrink-0 text-[var(--color-text-tertiary)]" />
                        <span className="italic">&ldquo;{r.comment}&rdquo;</span>
                      </p>
                    )}
                    <p className="text-[10px] text-[var(--color-text-tertiary)]">
                      {rater?.full_name ?? "Organizer"} · {evt?.event_name ?? "Event"} ·{" "}
                      {new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <div className="text-3xl font-black text-amber-400 shrink-0">
                    {r.rating}.0
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
