"use client";

import { Briefcase } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { VendorServiceCard } from "@/components/vendor/VendorServiceCard";
import type { VendorServiceRow } from "@/schemas/vendor.schema";

interface VendorServicesManagerProps {
  services: VendorServiceRow[];
  isLoading: boolean;
  onDelete: (id: string) => void;
  onEdit: (service: VendorServiceRow) => void;
}

export default function VendorServicesManager({ services, isLoading, onDelete, onEdit }: VendorServicesManagerProps) {
  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--color-border)] p-5 space-y-4">
            <Skeleton className="h-40 w-full rounded-[var(--radius-md)]" />
            <div className="space-y-3">
              <Skeleton className="h-6 w-3/4 rounded" />
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-1/2 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <EmptyState
        icon={Briefcase}
        title="No services listed yet"
        description="Add your first service to start receiving bookings and grow your business on the platform."
      />
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {services.map((service) => (
        <VendorServiceCard
          key={service.id}
          service={service}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
