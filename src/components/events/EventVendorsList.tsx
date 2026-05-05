"use client";

// src/components/events/EventVendorsList.tsx
// Shows hired vendors for an event (from service_requests where status = 'accepted').
// Also allows organizers to rate a vendor after the event.

import { useState } from "react";
import useSWR from "swr";
import { supabase } from "@/services/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/button";
import { User, Mail, Store, Star } from "lucide-react";
import { formatINR } from "@/lib/format";
import { VendorRatingModal } from "@/components/vendor/VendorRatingModal";

interface HiredVendorRow {
  id: string; // service_request id
  service_id: string;
  vendor_id: string;
  status: string;
  events: { start_date: string; event_status: string } | null;
  vendor_services: { service_name: string; base_price: number; category: string } | null;
  profiles: { full_name: string; email: string } | null;
}

interface EventVendorsListProps {
  eventId: string;
}

export function EventVendorsList({ eventId }: EventVendorsListProps) {
  const { session } = useAuth();
  const [ratingModal, setRatingModal] = useState<{
    serviceRequestId: string;
    vendorName: string;
    serviceName: string;
  } | null>(null);

  // Fetch from service_requests (accepted) — this is the REAL "pro team"
  // event_vendors is a separate formal roster that is currently empty in seed data.
  const { data: hiredVendors, isLoading, mutate } = useSWR(
    eventId ? ["hired-vendors", eventId] : null,
    async () => {
      const { data, error } = await supabase
        .from("service_requests")
        .select(`
          id, service_id, vendor_id, status,
          events:event_id (start_date, event_status),
          vendor_services:service_id (service_name, base_price, category),
          profiles:vendor_id (full_name, email)
        `)
        .eq("event_id", eventId)
        .in("status", ["accepted", "completed"])
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []).map((r) => ({
        ...r,
        events: Array.isArray(r.events) ? r.events[0] ?? null : r.events,
        vendor_services: Array.isArray(r.vendor_services) ? r.vendor_services[0] ?? null : r.vendor_services,
        profiles: Array.isArray(r.profiles) ? r.profiles[0] ?? null : r.profiles,
      })) as HiredVendorRow[];
    },
    { revalidateOnFocus: false }
  );

  // Fetch which service_request IDs this user has already rated
  const { data: ratedIds, mutate: mutateRatings } = useSWR(
    session?.user?.id ? ["my-ratings-ids", eventId, session.user.id] : null,
    async () => {
      const { data } = await supabase
        .from("vendor_ratings")
        .select("service_request_id")
        .eq("event_id", eventId)
        .eq("rater_id", session?.user?.id);
      return new Set((data ?? []).map((r) => r.service_request_id));
    },
    { revalidateOnFocus: false }
  );

  function canRate(v: HiredVendorRow) {
    const eventDate = v.events?.start_date;
    if (!eventDate) return false;
    return new Date(eventDate) <= new Date();
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(2)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!hiredVendors || hiredVendors.length === 0) {
    return (
      <div className="text-center py-8 border border-dashed border-[var(--color-border)] rounded-lg text-[var(--color-text-tertiary)] bg-[var(--color-surface)]">
        <Store className="mx-auto mb-2 opacity-30" size={32} />
        <p className="text-sm">No accepted vendors for this event yet.</p>
        <p className="text-xs mt-1 opacity-60">Accepted service requests will appear here.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {hiredVendors.map((vendor) => {
          const alreadyRated = ratedIds?.has(vendor.id) ?? false;
          const eligible = canRate(vendor);

          return (
            <Card key={vendor.id} className="bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-brand)]/40 transition-all shadow-sm">
              <CardHeader className="pb-2 border-b border-[var(--color-border)]/50">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[var(--color-brand)]/10 rounded-full text-[var(--color-brand)]">
                      <User size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-[var(--color-text-primary)]">
                        {vendor.profiles?.full_name ?? "Unknown Vendor"}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                        <Mail size={12} />
                        <span>{vendor.profiles?.email}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="success" className="text-[10px] uppercase">
                      {vendor.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-3">
                <div className="flex justify-between items-center bg-[var(--color-background)] p-3 rounded-md border border-[var(--color-border)]/50">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-tertiary)]">Service</p>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {vendor.vendor_services?.service_name ?? "—"}
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)] capitalize">
                      {vendor.vendor_services?.category}
                    </p>
                  </div>
                  <div className="text-right space-y-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-tertiary)]">Price</p>
                      <p className="font-bold text-[var(--color-brand)]">
                        {formatINR(vendor.vendor_services?.base_price ?? 0)}
                      </p>
                    </div>
                    {/* Rating button — only after event date */}
                    {eligible ? (
                      alreadyRated ? (
                        <div className="flex items-center gap-1 text-xs text-amber-400 font-semibold">
                          <Star size={12} className="fill-amber-400" />
                          Rated
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 border-amber-400/40 text-amber-400 hover:bg-amber-400/10 hover:border-amber-400"
                          onClick={() => setRatingModal({
                            serviceRequestId: vendor.id,
                            vendorName: vendor.profiles?.full_name ?? "Vendor",
                            serviceName: vendor.vendor_services?.service_name ?? "Service",
                          })}
                        >
                          <Star size={11} className="mr-1" />
                          Rate
                        </Button>
                      )
                    ) : (
                      <p className="text-[10px] text-[var(--color-text-tertiary)] italic">
                        Rate after event
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Rating Modal */}
      {ratingModal && (
        <VendorRatingModal
          isOpen={true}
          onClose={() => setRatingModal(null)}
          serviceRequestId={ratingModal.serviceRequestId}
          vendorName={ratingModal.vendorName}
          serviceName={ratingModal.serviceName}
          onSuccess={() => {
            setRatingModal(null);
            mutateRatings();
            mutate();
          }}
        />
      )}
    </>
  );
}
