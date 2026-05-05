"use client";

// src/components/vendor/VendorRatingModal.tsx
// Star-rating modal for organizers to rate a vendor after their event.

import { useState } from "react";
import { Star, X, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  serviceRequestId: string;
  vendorName: string;
  serviceName: string;
  /** Called after a successful submission so the parent can refresh data */
  onSuccess?: () => void;
}

export function VendorRatingModal({
  isOpen, onClose, serviceRequestId, vendorName, serviceName, onSuccess,
}: Props) {
  const { session } = useAuth();
  const [stars, setStars] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit() {
    if (stars === 0) { setError("Please select a star rating."); return; }
    if (!session?.access_token) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/vendor-ratings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ serviceRequestId, rating: stars, comment: comment.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to submit rating"); return; }
      setSubmitted(true);
      onSuccess?.();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const starLabels = ["", "Poor", "Fair", "Good", "Great", "Excellent"];
  const displayed = hovered || stars;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-2xl w-full max-w-md pointer-events-auto animate-in zoom-in-95 duration-200">

          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
            <div>
              <h3 className="font-black text-[var(--color-text-primary)]">Rate Your Experience</h3>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                {serviceName} · {vendorName}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)] transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6">
            {submitted ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <CheckCircle2 size={48} className="text-emerald-400" />
                <p className="font-bold text-[var(--color-text-primary)]">Rating Submitted!</p>
                <p className="text-sm text-[var(--color-text-tertiary)]">
                  Thank you. Your feedback helps other organizers find great vendors.
                </p>
                <Button onClick={onClose} className="mt-2 bg-[var(--color-brand)] text-white">
                  Close
                </Button>
              </div>
            ) : (
              <>
                {/* Stars */}
                <div className="flex flex-col items-center gap-3">
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onMouseEnter={() => setHovered(n)}
                        onMouseLeave={() => setHovered(0)}
                        onClick={() => setStars(n)}
                        className="transition-transform hover:scale-110 active:scale-95"
                      >
                        <Star
                          size={36}
                          className={`transition-colors duration-150 ${
                            n <= displayed
                              ? "fill-amber-400 stroke-amber-400"
                              : "stroke-[var(--color-border)] fill-transparent"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <p className={`text-sm font-semibold transition-opacity duration-150 ${displayed ? "opacity-100" : "opacity-0"}`}>
                    {starLabels[displayed]}
                  </p>
                </div>

                {/* Comment */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2 block">
                    Add a comment (optional)
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Great vendor, arrived on time and exceeded expectations..."
                    maxLength={500}
                    rows={3}
                    className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] resize-none focus:outline-none focus:border-[var(--color-brand)] transition-colors"
                  />
                  <p className="text-[10px] text-[var(--color-text-tertiary)] text-right mt-1">{comment.length}/500</p>
                </div>

                {/* Error */}
                {error && (
                  <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">
                    {error}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <Button variant="outline" onClick={onClose} className="flex-1" disabled={submitting}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting || stars === 0}
                    className="flex-1 bg-[var(--color-brand)] text-white disabled:opacity-40"
                  >
                    {submitting ? <><Loader2 size={14} className="animate-spin mr-2" /> Submitting…</> : "Submit Rating"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
