// src/components/dashboard/SmartBudgetPlanner.tsx
// Drawer that shows MOEA/D-generated vendor bundles for the organizer to pick

"use client";

import { useState, useEffect } from "react";
import {
  X, Sparkles, CheckCircle2, TrendingUp, Loader2,
  AlertCircle, ChevronRight, ChevronLeft, Tag,
} from "lucide-react";
import { formatINR } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { supabase } from "@/services/supabase/client";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface VendorInBundle {
  id: string;
  vendorId: string;
  serviceName: string;
  category: string;
  baseCost: number;
  qualityScore: number;
  rating: number;
}

interface Bundle {
  label: string;
  vendors: VendorInBundle[];
  totalCost: number;
  totalQuality: number;
  averageRating: number;
  improvementOverGreedy: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  budget: number;
}

const CATEGORY_EMOJI_MAP: Record<string, string> = {
  catering: "🍽️",
  photography: "📷",
  videography: "🎬",
  decoration: "🌸",
  entertainment: "🎵",
  security: "🛡️",
  venue: "🏛️",
  logistics: "🚌",
};

// ─── Component ─────────────────────────────────────────────────────────────────

export function SmartBudgetPlanner({ isOpen, onClose, eventId, budget }: Props) {
  const { session } = useAuth();

  // Step: "pick" → category selection, "results" → bundle results
  const [step, setStep] = useState<"pick" | "results">("pick");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [dynamicCategories, setDynamicCategories] = useState<{value: string, label: string, emoji: string, count: number}[]>([]);

  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [applied, setApplied] = useState(false);

  // Reset when drawer opens
  useEffect(() => {
    if (isOpen) {
      setStep("pick");
      setBundles([]);
      setSelectedIdx(null);
      setError(null);
      setApplied(false);

      if (dynamicCategories.length === 0) {
        supabase.from('vendor_services').select('category').then(({ data }) => {
          if (data) {
            const counts: Record<string, number> = {};
            data.forEach(r => {
              const cat = r.category?.toLowerCase() || 'other';
              counts[cat] = (counts[cat] || 0) + 1;
            });
            
            const sorted = Object.entries(counts)
              .sort((a, b) => b[1] - a[1])
              .map(([val, count]) => ({
                value: val,
                label: val.charAt(0).toUpperCase() + val.slice(1),
                emoji: CATEGORY_EMOJI_MAP[val] || "✨",
                count
              }));
              
            setDynamicCategories(sorted);
            setSelectedCategories(sorted.slice(0, 3).map(c => c.value));
          }
        });
      }
    }
  }, [isOpen, dynamicCategories.length]);

  function toggleCategory(value: string) {
    setSelectedCategories(prev =>
      prev.includes(value) ? prev.filter(c => c !== value) : [...prev, value]
    );
  }

  async function runOptimizer() {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    setBundles([]);
    setSelectedIdx(null);
    setApplied(false);
    setStep("results");

    try {
      const res = await fetch("/api/algorithms/budget-optimizer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          eventId,
          budget,
          requiredCategories: selectedCategories,
        }),
      });

      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Optimisation failed"); return; }
      setBundles(json.bundles ?? []);
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  // Send service requests for every vendor in the selected bundle
  async function applyBundle() {
    if (selectedIdx === null || !session?.user?.id) return;
    const bundle = bundles[selectedIdx];
    if (!bundle) return;

    setApplying(true);
    setError(null);

    try {
      const userId = session.user.id;

      // Check for existing pending/accepted requests to avoid duplicates
      const { data: existing } = await supabase
        .from("service_requests")
        .select("service_id")
        .eq("event_id", eventId)
        .eq("requester_id", userId)
        .in("status", ["pending", "accepted"]);

      const existingServiceIds = new Set((existing ?? []).map(r => r.service_id));

      const toInsert = bundle.vendors
        .filter(v => !existingServiceIds.has(v.id))
        .map(v => ({
          event_id: eventId,
          service_id: v.id,
          requester_id: userId,
          vendor_id: v.vendorId,
          status: "pending",
          message: `Bundle: ${bundle.label} — requested via Smart Budget Planner (MOEA/D-DRA)`,
        }));

      if (toInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("service_requests")
          .insert(toInsert);

        if (insertError) throw new Error(insertError.message);
      }

      setApplied(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply bundle");
    } finally {
      setApplying(false);
    }
  }

  if (!isOpen) return null;

  const labelColors: Record<string, string> = {
    "Budget Pick": "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
    "Balanced": "bg-blue-400/10 text-blue-400 border-blue-400/20",
    "Premium": "bg-purple-400/10 text-purple-400 border-purple-400/20",
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-xl bg-[var(--color-background)] border-l border-[var(--color-border)] z-50 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={16} className="text-[var(--color-brand)]" />
              <h2 className="text-lg font-black text-[var(--color-text-primary)]">Smart Budget Planner</h2>
            </div>
            <p className="text-sm text-[var(--color-text-tertiary)]">
              Budget: <span className="font-bold text-[var(--color-text-primary)]">{formatINR(budget)}</span>
              {selectedCategories.length > 0 && step === "results" && (
                <span className="ml-2 text-[var(--color-brand)]">
                  · {selectedCategories.length} categories required
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── STEP 1: Category Picker ── */}
        {step === "pick" && (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Tag size={14} className="text-[var(--color-brand)]" />
                  <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                    Which vendor categories do you need?
                  </h3>
                </div>
                <p className="text-xs text-[var(--color-text-tertiary)] ml-5">
                  Select the categories that are essential for your event. MOEA/D will guarantee at least one vendor from each. Leave all unselected to let the algorithm decide freely.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {dynamicCategories.map((cat) => {
                  const isSelected = selectedCategories.includes(cat.value);
                  return (
                    <button
                      key={cat.value}
                      onClick={() => toggleCategory(cat.value)}
                      className={`
                        flex items-center gap-3 p-4 rounded-2xl border text-left transition-all duration-200
                        ${isSelected
                          ? "border-[var(--color-brand)] bg-[var(--color-brand)]/8 shadow-sm shadow-blue-500/10"
                          : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-brand)]/40"
                        }
                      `}
                    >
                      <span className="text-2xl">{cat.emoji}</span>
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold truncate ${isSelected ? "text-[var(--color-brand)]" : "text-[var(--color-text-primary)]"}`}>
                          {cat.label} <span className="text-[10px] text-[var(--color-text-tertiary)] font-normal ml-1">({cat.count})</span>
                        </p>
                        {isSelected && (
                          <p className="text-[10px] text-[var(--color-brand)] font-bold uppercase tracking-wider">Required</p>
                        )}
                      </div>
                      {isSelected && (
                        <CheckCircle2 size={16} className="text-[var(--color-brand)] ml-auto flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedCategories.length > 0 && (
                <div className="p-3 rounded-xl bg-[var(--color-brand)]/5 border border-[var(--color-brand)]/20">
                  <p className="text-xs text-[var(--color-brand)] font-semibold">
                    ✓ Required: {selectedCategories.map(c => dynamicCategories.find(a => a.value === c)?.label || c).join(", ")}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">
                    Every bundle will include at least one vendor from these categories.
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-[var(--color-border)]">
              <Button
                onClick={runOptimizer}
                className="w-full h-12 bg-[var(--color-brand)] text-white font-bold text-sm shadow-lg shadow-blue-500/20"
              >
                <Sparkles size={15} className="mr-2" />
                {selectedCategories.length > 0
                  ? `Optimize with ${selectedCategories.length} required categor${selectedCategories.length === 1 ? "y" : "ies"}`
                  : "Optimize freely (no category requirements)"}
              </Button>
            </div>
          </>
        )}

        {/* ── STEP 2: Bundle Results ── */}
        {step === "results" && (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">

              {/* Back button */}
              <button
                onClick={() => setStep("pick")}
                className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-text-tertiary)] hover:text-[var(--color-brand)] transition-colors mb-2"
              >
                <ChevronLeft size={14} /> Change categories
              </button>

              {/* Loading */}
              {loading && (
                <div className="flex flex-col items-center justify-center py-20 gap-4 text-[var(--color-text-tertiary)]">
                  <Loader2 size={32} className="animate-spin text-[var(--color-brand)]" />
                  <p className="text-sm">Running MOEA/D-DRA optimisation…</p>
                  {selectedCategories.length > 0 && (
                    <p className="text-xs opacity-60">Guaranteeing: {selectedCategories.join(", ")}</p>
                  )}
                </div>
              )}

              {/* Error */}
              {error && !loading && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                  <AlertCircle size={16} />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              {/* Applied success */}
              {applied && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <CheckCircle2 size={16} />
                  <div>
                    <p className="text-sm font-bold">Bundle applied!</p>
                    <p className="text-xs opacity-80">Service requests sent to all vendors. Check the Inquiries tab.</p>
                  </div>
                </div>
              )}

              {/* Empty */}
              {!loading && !error && bundles.length === 0 && (
                <div className="py-20 text-center text-[var(--color-text-tertiary)]">
                  <p className="text-sm">No bundles found within this budget.</p>
                  <p className="text-xs mt-1 opacity-60">Try removing some required categories or increasing the budget.</p>
                </div>
              )}

              {/* Bundles */}
              {!loading && bundles.map((bundle, i) => {
                const isSelected = selectedIdx === i;
                const colorClass = labelColors[bundle.label] ?? labelColors["Balanced"];

                return (
                  <div
                    key={i}
                    onClick={() => !applied && setSelectedIdx(isSelected ? null : i)}
                    className={`
                      rounded-2xl border p-5 transition-all duration-200
                      ${applied ? "opacity-60 cursor-default" : "cursor-pointer"}
                      ${isSelected
                        ? "border-[var(--color-brand)] bg-[var(--color-brand)]/5 shadow-lg shadow-blue-500/10"
                        : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-brand)]/40"
                      }
                    `}
                  >
                    {/* Bundle header */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${colorClass}`}>
                          {bundle.label}
                        </span>
                        {bundle.improvementOverGreedy > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                            <TrendingUp size={11} />
                            {bundle.improvementOverGreedy}% better than cheapest sort
                          </span>
                        )}
                      </div>
                      {isSelected && <CheckCircle2 size={18} className="text-[var(--color-brand)] flex-shrink-0" />}
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="text-center p-2 rounded-xl bg-[var(--color-background)]">
                        <p className="text-[10px] text-[var(--color-text-tertiary)] uppercase tracking-wider mb-0.5">Cost</p>
                        <p className="text-sm font-bold text-[var(--color-text-primary)]">{formatINR(bundle.totalCost)}</p>
                      </div>
                      <div className="text-center p-2 rounded-xl bg-[var(--color-background)]">
                        <p className="text-[10px] text-[var(--color-text-tertiary)] uppercase tracking-wider mb-0.5">Quality</p>
                        <p className="text-sm font-bold text-[var(--color-text-primary)]">{Math.round(bundle.totalQuality)}/100</p>
                      </div>
                      <div className="text-center p-2 rounded-xl bg-[var(--color-background)]">
                        <p className="text-[10px] text-[var(--color-text-tertiary)] uppercase tracking-wider mb-0.5">Rating</p>
                        <p className="text-sm font-bold text-[var(--color-text-primary)]">{bundle.averageRating.toFixed(1)} <span className="text-[10px] text-[var(--color-text-tertiary)] relative -top-0.5">/5</span></p>
                      </div>
                    </div>

                    {/* Vendor list */}
                    <div className="space-y-2">
                      {bundle.vendors.map((v, j) => {
                        const isRequired = selectedCategories.includes(v.category);
                        return (
                          <div key={j} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isRequired ? "bg-[var(--color-brand)]" : "bg-[var(--color-brand)]/40"}`} />
                              <span className="text-[var(--color-text-primary)] truncate font-medium">{v.serviceName}</span>
                              <span className={`text-[10px] capitalize px-1.5 py-0.5 rounded-full flex-shrink-0 ${isRequired
                                  ? "bg-[var(--color-brand)]/15 text-[var(--color-brand)] font-bold"
                                  : "bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)]"
                                }`}>
                                {v.category}{isRequired ? " ✓" : ""}
                              </span>
                            </div>
                            <span className="text-[var(--color-text-secondary)] font-semibold flex-shrink-0 ml-2">
                              {formatINR(v.baseCost)}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Budget bar */}
                    <div className="mt-4">
                      <div className="flex justify-between text-[10px] text-[var(--color-text-tertiary)] mb-1">
                        <span>Budget used</span>
                        <span>{Math.round((bundle.totalCost / budget) * 100)}%</span>
                      </div>
                      <div className="h-1.5 bg-[var(--color-background)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--color-brand)] rounded-full transition-all duration-500"
                          style={{ width: `${Math.min((bundle.totalCost / budget) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-[var(--color-border)] flex gap-3">
              <Button
                variant="outline"
                onClick={() => { setStep("pick"); }}
                disabled={loading || applying}
                className="flex-1"
              >
                <ChevronLeft size={14} className="mr-1" /> Back
              </Button>
              <Button
                onClick={applied ? onClose : applyBundle}
                disabled={(!applied && selectedIdx === null) || applying || loading}
                className="flex-1 bg-[var(--color-brand)] text-white disabled:opacity-40"
              >
                {applying ? (
                  <><Loader2 size={14} className="animate-spin mr-2" /> Sending requests…</>
                ) : applied ? (
                  <>Done <CheckCircle2 size={14} className="ml-1" /></>
                ) : selectedIdx !== null ? (
                  <>Use {bundles[selectedIdx]?.label} <ChevronRight size={14} className="ml-1" /></>
                ) : (
                  "Select a bundle"
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}