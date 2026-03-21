"use client";

import useSWR from "swr";
import { supabase } from "@/services/supabase/client";
import { X, IndianRupee, TrendingUp, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { formatINR } from "@/lib/format";
import { BookingStatusBadge, type StatusType } from "@/components/ui/StatusBadge";
import type { ServiceRequest } from "@/lib/supabase-types";
import { logger } from "@/lib/logger";

interface EventCostSummaryProps {
  eventId: string;
  eventName: string;
  budget?: number;
  onClose: () => void;
}

interface StrictServiceJoin {
  service_name: string;
  base_price: number;
  category: string;
}

interface StrictProfileJoin {
  full_name: string;
  email: string;
}

interface CostSummaryRequest extends ServiceRequest {
  vendor_services: StrictServiceJoin | null;
  profiles: StrictProfileJoin | null;
}

interface CategoryGroup {
  category: string;
  requests: CostSummaryRequest[];
  totalSpend: number;
}

export function EventCostSummary({ eventId, eventName, budget, onClose }: EventCostSummaryProps) {
  
  const { data: requests = [], isLoading } = useSWR<CostSummaryRequest[]>(
    ["event-cost-summary", eventId],
    async () => {
      const { data, error } = await supabase
        .from("service_requests")
        .select(`
          id, event_id, service_id, requester_id, vendor_id, status,
          vendor_services(service_name, base_price, category),
          profiles!vendor_id(full_name, email)
        `)
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });

      if (error) {
        logger.error("[EventCostSummary] Fetch failed", error);
        throw new Error(error.message);
      }

      return data.map((r) => ({
        ...r,
        vendor_services: Array.isArray(r.vendor_services) ? r.vendor_services[0] : r.vendor_services || null,
        profiles: Array.isArray(r.profiles) ? r.profiles[0] : r.profiles || null,
      })) as CostSummaryRequest[];
    }
  );

  const groups: CategoryGroup[] = Object.values(
    requests.reduce<Record<string, CategoryGroup>>((acc, req) => {
      const cat = req.vendor_services?.category ?? "Uncategorised";
      if (!acc[cat]) acc[cat] = { category: cat, requests: [], totalSpend: 0 };
      
      acc[cat].requests.push(req);
      if (req.status === "accepted") {
        acc[cat].totalSpend += req.vendor_services?.base_price ?? 0;
      }
      return acc;
    }, {})
  );

  const totalCommitted = groups.reduce((sum, g) => sum + g.totalSpend, 0);
  const maxPossible = requests.reduce((sum, r) => sum + (r.vendor_services?.base_price ?? 0), 0);
  const savings = maxPossible - totalCommitted;
  const numCats = groups.length || 1;
  const perCatBudget = budget ? budget / numCats : null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-in fade-in duration-200" onClick={onClose} />
      
      <div className="fixed right-4 top-4 bottom-4 w-full max-w-lg bg-[var(--color-background)] border border-[var(--color-border)] rounded-[var(--radius-xl)] z-50 flex flex-col xl:animate-in xl:slide-in-from-right duration-300 shadow-[var(--shadow-xl)]">
        <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] shrink-0">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Cost Summary</h2>
            <p className="text-sm text-[var(--color-text-secondary)] truncate max-w-xs">{eventName}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors">
            <X size={18} />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-6 h-6 text-[var(--color-brand)] animate-spin" />
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12 text-[var(--color-text-tertiary)] bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] rounded-[var(--radius-lg)]">
              <IndianRupee size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No active service requests.</p>
            </div>
          ) : (
            <>
              {budget && (
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-4 space-y-3 shadow-sm">
                  <div className="flex justify-between text-xs text-[var(--color-text-secondary)] font-semibold uppercase tracking-wider">
                    <span>Committed Spend</span>
                    <span>Total Budget</span>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className="text-2xl font-bold text-[var(--color-text-primary)]">{formatINR(totalCommitted)}</span>
                    <span className="text-sm font-semibold text-[var(--color-text-tertiary)]">of {formatINR(budget)}</span>
                  </div>
                  <div className="h-2 bg-[var(--color-background)] rounded-full overflow-hidden flex shadow-inner">
                    <div
                      className={`h-full rounded-r-md transition-all ${totalCommitted > budget ? "bg-[var(--color-danger)]" : (totalCommitted / budget) >= 0.8 ? "bg-amber-500" : "bg-[var(--color-success)]"}`}
                      style={{ width: `${Math.min((totalCommitted / budget) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wider">Category Breakdown</h3>
                {groups.map((group) => {
                  const isOver = perCatBudget !== null && group.totalSpend > perCatBudget;
                  return (
                    <div key={group.category} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]/50 bg-[var(--color-background)]/50">
                        <div className="flex items-center gap-2">
                          {isOver ? <AlertTriangle size={14} className="text-[var(--color-danger)]" /> : <CheckCircle2 size={14} className="text-[var(--color-success)]" />}
                          <span className="font-semibold text-sm text-[var(--color-text-primary)]">{group.category}</span>
                        </div>
                        <div className="text-right flex items-center gap-2">
                          <span className={`text-sm font-bold ${isOver ? "text-[var(--color-danger)]" : "text-[var(--color-text-primary)]"}`}>
                            {formatINR(group.totalSpend)}
                          </span>
                        </div>
                      </div>
                      <div className="divide-y divide-[var(--color-border)]/50">
                        {group.requests.map((req) => (
                          <div key={req.id} className="flex items-center justify-between px-4 py-3 hover:bg-[var(--color-surface-hover)] transition-colors">
                            <div>
                              <p className="text-sm font-medium text-[var(--color-text-secondary)]">{req.vendor_services?.service_name ?? "Service"}</p>
                              <p className="text-xs text-[var(--color-text-tertiary)]">{req.profiles?.full_name ?? "Vendor"}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                                {formatINR(req.vendor_services?.base_price ?? 0)}
                              </span>
                              <BookingStatusBadge status={req.status as StatusType} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-4 space-y-3">
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-[var(--color-text-secondary)]">Total Committed Spend</span>
                  <span className="font-bold text-[var(--color-text-primary)]">{formatINR(totalCommitted)}</span>
                </div>
                {savings > 0 && (
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-[var(--color-success)] flex items-center gap-1.5">
                      <TrendingUp size={14} /> Pipeline Savings
                    </span>
                    <span className="font-bold text-[var(--color-success)]">{formatINR(savings)}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}
