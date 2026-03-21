"use client";

import { useState } from "react";
import useSWR from "swr";
import { supabase } from "@/services/supabase/client";
import { IndianRupee, TrendingUp, AlertTriangle, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { formatINR } from "@/lib/format";
import { SmartBudgetPlanner } from "@/components/dashboard/SmartBudgetPlanner";

interface BudgetTrackerProps {
  userId: string;
}

interface AggregateSpend {
  totalBudget: number;
  accepted: number;
  pending: number;
  eventId: string | null;   // first event with a budget — used by the planner
}

interface BudgetRequestRow {
  status: string;
  vendor_services: { base_price: number } | null;
}

export function BudgetTracker({ userId }: BudgetTrackerProps) {
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);

  const { data: spend, isLoading, error } = useSWR<AggregateSpend>(
    ["aggregate-budget", userId],
    async () => {
      const [
        { data: events, error: eventsErr },
        { data: requests, error: requestsErr }
      ] = await Promise.all([
        supabase.from("events").select("id, budget").eq("user_id", userId),
        supabase.from("service_requests").select("status, vendor_services(base_price), events!inner(user_id)").eq("events.user_id", userId).in("status", ["accepted", "pending"])
      ]);

      if (eventsErr) throw new Error(eventsErr.message);
      if (requestsErr) throw new Error(requestsErr.message);

      const totalBudget = events?.reduce((sum, e) => sum + (e.budget || 0), 0) || 0;

      // First event that has a non-zero budget — used for the planner call
      const firstEventWithBudget = events?.find(e => e.budget > 0) ?? null;

      let accepted = 0;
      let pending = 0;

      const typedRequests = (requests || []) as unknown as BudgetRequestRow[];

      for (const row of typedRequests) {
        const price = row.vendor_services?.base_price ?? 0;
        if (row.status === "accepted") accepted += price;
        else if (row.status === "pending") pending += price;
      }

      return { totalBudget, accepted, pending, eventId: firstEventWithBudget?.id ?? null };
    },
    { revalidateOnFocus: true }
  );

  if (isLoading) {
    return (
      <div className="animate-pulse h-24 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] flex items-center justify-center text-[var(--color-text-tertiary)]">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (error || !spend) {
    return (
      <div className="h-24 bg-[var(--color-danger-muted)] border border-[var(--color-danger)] text-[var(--color-danger)] rounded-[var(--radius-lg)] flex items-center justify-center text-sm font-medium">
        Failed to load budget data.
      </div>
    );
  }

  const { totalBudget, accepted, pending, eventId } = spend;
  const committed = accepted;

  if (totalBudget === 0) {
    return (
      <div className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] space-y-2">
        <p className="text-sm text-[var(--color-text-secondary)]">No budgets defined yet. Create an event with a budget to track spending.</p>
      </div>
    );
  }

  const pct = Math.min(((committed + pending) / totalBudget) * 100, 100);
  const committedPct = Math.min((committed / totalBudget) * 100, 100);
  const isOver = committed > totalBudget;
  const isNearLimit = !isOver && (committed + pending) / totalBudget >= 0.8;
  const remaining = totalBudget - committed;

  const StatusIcon = isOver ? AlertTriangle : isNearLimit ? TrendingUp : CheckCircle2;
  const statusColor = isOver
    ? "text-[var(--color-danger)]"
    : isNearLimit
    ? "text-amber-500"
    : "text-[var(--color-success)]";

  return (
    <>
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-5 space-y-4 shadow-sm">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
            <div className="p-1.5 rounded-md bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
              <IndianRupee size={16} />
            </div>
            Overall Budget
          </div>
          <div className={`flex items-center gap-1.5 text-xs font-medium ${statusColor} bg-current/10 px-2 py-1 rounded-full`}>
            <StatusIcon size={14} />
            {isOver ? "Over budget" : isNearLimit ? "Near limit" : "On track"}
          </div>
        </div>

        {/* Stacked progress bar */}
        <div className="h-2 bg-[var(--color-background)] rounded-full overflow-hidden flex shadow-inner">
          <div
            className={`h-full rounded-r-md transition-all duration-500 ${isOver ? "bg-[var(--color-danger)]" : "bg-[var(--color-success)]"}`}
            style={{ width: `${committedPct}%` }}
          />
          {pending > 0 && (
            <div
              className="h-full bg-amber-400 transition-all duration-500"
              style={{ width: `${Math.min((pending / totalBudget) * 100, pct - committedPct)}%` }}
            />
          )}
        </div>

        {/* Stats */}
        <div className="flex justify-between text-xs lg:text-sm">
          <div className="flex flex-col gap-1">
            <span className="text-[var(--color-text-secondary)]">
              <span className="text-[var(--color-text-primary)] font-semibold">{formatINR(committed)}</span> committed
            </span>
            {pending > 0 && (
              <span className="text-amber-500 font-medium text-xs">+{formatINR(pending)} pending checks</span>
            )}
          </div>
          <div className="text-right flex flex-col gap-1">
            <span className="text-[var(--color-text-secondary)] font-medium">Total: {formatINR(totalBudget)}</span>
            <span className={`font-semibold ${isOver ? "text-[var(--color-danger)]" : "text-[var(--color-success)]"}`}>
              {isOver ? `−${formatINR(Math.abs(remaining))} over` : `${formatINR(remaining)} left`}
            </span>
          </div>
        </div>

        {/* Optimize Budget button — only shown when we have an eventId */}
        {eventId && (
          <button
            onClick={() => setIsPlannerOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-[var(--color-brand)]/30 bg-[var(--color-brand)]/5 text-[var(--color-brand)] text-sm font-bold hover:bg-[var(--color-brand)]/10 transition-colors"
          >
            <Sparkles size={14} />
            Optimize Budget
          </button>
        )}
      </div>

      {/* SmartBudgetPlanner drawer */}
      {eventId && (
        <SmartBudgetPlanner
          isOpen={isPlannerOpen}
          onClose={() => setIsPlannerOpen(false)}
          eventId={eventId}
          budget={totalBudget}
        />
      )}
    </>
  );
}
