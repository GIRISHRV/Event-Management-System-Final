"use client";

import { useEventVendors } from "@/hooks/useEventVendors";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { User, Mail, DollarSign, Store } from "lucide-react";
import { formatINR } from "@/lib/format";

interface EventVendorsListProps {
  eventId: string;
}

export function EventVendorsList({ eventId }: EventVendorsListProps) {
  const { hiredVendors, isLoading } = useEventVendors(eventId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(2)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (hiredVendors.length === 0) {
    return (
      <div className="text-center py-8 border border-dashed border-[var(--color-border)] rounded-lg text-[var(--color-text-tertiary)] bg-[var(--color-surface)]">
        <Store className="mx-auto mb-2 opacity-30" size={32} />
        <p className="text-sm">No vendors hired yet for this event.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {hiredVendors.map((vendor) => (
        <Card key={vendor.id} className="bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-brand)]/40 transition-all shadow-sm">
          <CardHeader className="pb-2 border-b border-[var(--color-border)]/50">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[var(--color-brand)]/10 rounded-full text-[var(--color-brand)]">
                  <User size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-[var(--color-text-primary)]">{vendor.profiles.full_name}</h4>
                  <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                    <Mail size={12} />
                    <span>{vendor.profiles.email}</span>
                  </div>
                </div>
              </div>
              <Badge variant="success" className="text-[10px] uppercase">Hired</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            <div className="flex justify-between items-center bg-[var(--color-background)] p-3 rounded-md border border-[var(--color-border)]/50">
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-tertiary)]">Service Provided</p>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">{vendor.vendor_services.service_name}</p>
                <p className="text-xs text-[var(--color-text-secondary)] capitalize">{vendor.vendor_services.category}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-tertiary)]">Price</p>
                <div className="flex items-center justify-end text-[var(--color-brand)] font-bold">
                  <DollarSign size={14} />
                  <span>{formatINR(vendor.vendor_services.base_price)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
