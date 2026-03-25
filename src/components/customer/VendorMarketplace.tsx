"use client";

import React, { useState, useCallback } from "react";
import Image from "next/image";
import { useMarketplace } from "@/hooks/useVendors";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/services/supabase/client";
// FIX: Use the correct exported type name
import { VendorServiceRow } from "@/schemas/vendor.schema";
import { VendorServiceCard } from "../vendor/VendorServiceCard";
import { Drawer } from "../ui/Drawer";
import { Search, SlidersHorizontal, Loader2 } from "lucide-react";
import { Button } from "../ui/button";

export function VendorMarketplace() {
  const { marketplaceItems: vendors, isLoading } = useMarketplace({ page: 1, limit: 50 });
  const { session } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVendor, setSelectedVendor] = useState<VendorServiceRow | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterCategories, setFilterCategories] = useState<Set<string>>(new Set());
  const [maxPrice, setMaxPrice] = useState<number>(0); // 0 = no limit

  // Build unique categories from data
  const allCategories = [...new Set((vendors ?? []).map((v: VendorServiceRow) => v.category))];

  // Fire-and-forget vendor view tracking (#7)
  const trackVendorView = useCallback((service: VendorServiceRow) => {
    const userId = session?.user?.id;
    if (!userId) return;
    supabase.from("user_interactions").upsert({
      user_id: userId,
      event_id: null,
      interaction_type: "vendor_view",
      implicit_score: 0.2,
      vendor_service_id: service.id,
    }, { onConflict: "user_id,interaction_type,vendor_service_id" }).then(() => {
      supabase.from("algorithm_results").delete()
        .eq("user_id", userId).eq("algorithm_type", "gnn-cf");
    });
  }, [session?.user?.id]);

  const filteredVendors = vendors?.filter((v: VendorServiceRow) => {
    const matchesSearch =
      v.service_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategories.size === 0 || filterCategories.has(v.category);
    const matchesPrice = maxPrice === 0 || (v.base_price ?? 0) <= maxPrice;
    return matchesSearch && matchesCategory && matchesPrice;
  });

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Search and Filter Bar - Fixed at top */}
      <div className="shrink-0 flex flex-col md:flex-row gap-4 items-center justify-between bg-[var(--color-surface)] p-4 rounded-xl border border-[var(--color-border)] mb-6 shadow-sm">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] w-4 h-4" />
          <input
            type="text"
            placeholder="Search for catering, decor, photography..."
            className="w-full h-10 pl-10 pr-4 bg-[var(--color-background)] border border-[var(--color-border)] rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button
          variant="secondary"
          className={`w-full md:w-auto gap-2 rounded-full ${showFilters ? 'ring-2 ring-[var(--color-brand)]' : ''}`}
          onClick={() => setShowFilters(!showFilters)}
        >
          <SlidersHorizontal size={16} />
          Filters {filterCategories.size > 0 && `(${filterCategories.size})`}
        </Button>
      </div>

      {/* Filter Panel (#14) */}
      {showFilters && (
        <div className="shrink-0 flex flex-wrap gap-2 items-center bg-[var(--color-surface)] p-4 rounded-xl border border-[var(--color-border)] mb-4 animate-in fade-in duration-200">
          <div className="w-full mb-2">
            <p className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-widest mb-2">Categories</p>
            <div className="flex flex-wrap gap-2">
              {allCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => {
                    const next = new Set(filterCategories);
                    if (next.has(cat)) next.delete(cat); else next.add(cat);
                    setFilterCategories(next);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all ${
                    filterCategories.has(cat)
                      ? 'bg-[var(--color-brand)] text-white'
                      : 'bg-[var(--color-background)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-[var(--color-brand)]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <div className="w-full">
            <p className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-widest mb-2">Max Price: {maxPrice === 0 ? 'Any' : `₹${maxPrice.toLocaleString()}`}</p>
            <input
              type="range"
              min="0"
              max="50000"
              step="1000"
              value={maxPrice}
              onChange={e => setMaxPrice(Number(e.target.value))}
              className="w-full accent-[var(--color-brand)]"
            />
          </div>
          {(filterCategories.size > 0 || maxPrice > 0) && (
            <button
              onClick={() => { setFilterCategories(new Set()); setMaxPrice(0); }}
              className="text-xs text-[var(--color-brand)] font-semibold hover:underline"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Grid - Scrollable area */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--color-brand)]" />
            <p className="mt-4 text-[var(--color-text-tertiary)] font-medium">Loading marketplace...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-10">
            {filteredVendors?.map((service: VendorServiceRow) => (
              <VendorServiceCard
                key={service.id}
                service={service}
                onClick={() => {
                  trackVendorView(service);
                  setSelectedVendor(service);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      <Drawer
        isOpen={!!selectedVendor}
        onClose={() => setSelectedVendor(null)}
        title={selectedVendor?.service_name}
        description={`${selectedVendor?.category} service`}
        size="lg"
      >
        {selectedVendor && (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
              <div className="relative aspect-video rounded-xl overflow-hidden border border-[var(--color-border)] shadow-inner bg-[var(--color-surface-hover)]">
                <Image
                  src={selectedVendor.images?.[0] || "https://images.placeholder.com/600x400"}
                  fill
                  className="object-cover"
                  alt="cover"
                  unoptimized
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
                  <p className="text-[10px] text-[var(--color-text-tertiary)] uppercase font-bold tracking-widest">Starting Price</p>
                  <p className="text-xl font-bold text-[var(--color-text-primary)] mt-1">
                    ₹{selectedVendor.base_price?.toLocaleString() || "0"}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
                  <p className="text-[10px] text-[var(--color-text-tertiary)] uppercase font-bold tracking-widest">Category</p>
                  <p className="text-xl font-bold text-[var(--color-text-primary)] mt-1 capitalize">
                    {selectedVendor.category}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wider">About the Service</h4>
                <p className="text-base text-[var(--color-text-secondary)] leading-relaxed">
                  {selectedVendor.description}
                </p>
              </div>
            </div>

            <div className="shrink-0 p-6 border-t border-[var(--color-border)] bg-[var(--color-background)]">
              <Button className="w-full h-12 text-lg shadow-lg shadow-blue-500/20">
                Request Quote
              </Button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}