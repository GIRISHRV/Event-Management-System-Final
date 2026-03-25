"use client";

import React from "react";
import Image from "next/image";
import { IndianRupee, ExternalLink } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import type { VendorServiceRow } from "@/schemas/vendor.schema";

interface VendorServiceCardProps {
  service: VendorServiceRow;
  onClick?: () => void;
  onEdit?: (service: VendorServiceRow) => void;
  onDelete?: (id: string) => void;
  className?: string;
}

// Category-specific fallback images so every card looks different
const CATEGORY_IMAGES: Record<string, string> = {
  photography:
    "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=800&auto=format&fit=crop",
  entertainment:
    "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=800&auto=format&fit=crop",
  catering:
    "https://images.unsplash.com/photo-1555244162-803834f70033?q=80&w=800&auto=format&fit=crop",
  decoration:
    "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?q=80&w=800&auto=format&fit=crop",
  venue:
    "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?q=80&w=800&auto=format&fit=crop",
  videography:
    "https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=800&auto=format&fit=crop",
  security:
    "https://images.unsplash.com/photo-1582139329536-e7284fece509?q=80&w=800&auto=format&fit=crop",
  logistics:
    "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=800&auto=format&fit=crop",
  other:
    "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=800&auto=format&fit=crop",
  default:
    "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=800&auto=format&fit=crop",
};

function getCategoryImage(category: string, images?: string[] | null): string {
  // Use vendor's own image if available
  if (images && images.length > 0) return images[0];
  // Otherwise pick by category key (lowercase, partial match)
  const key = category?.toLowerCase() ?? "";
  for (const [cat, url] of Object.entries(CATEGORY_IMAGES)) {
    if (key.includes(cat)) return url;
  }
  return CATEGORY_IMAGES.default;
}

export function VendorServiceCard({
  service,
  onClick,
  onEdit,
  onDelete,
  className,
}: VendorServiceCardProps) {
  const mainImage = getCategoryImage(service.category, service.images);

  return (
    <div
      onClick={onClick}
      className={cn(
        "group cursor-pointer flex flex-col bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-xl)] overflow-hidden transition-all duration-300",
        "hover:-translate-y-1 hover:shadow-xl hover:border-[var(--color-brand)]",
        className
      )}
    >
      {/* Image */}
      <div className="relative aspect-[16/10] overflow-hidden bg-[var(--color-surface-hover)]">
        <Image
          src={mainImage}
          alt={service.service_name}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

        {/* Category Badge */}
        <div className="absolute top-3 left-3">
          <span className="px-2 py-1 rounded-md bg-white/90 dark:bg-black/80 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-primary)] shadow-sm">
            {service.category}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4">
        <h3 className="font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-brand)] transition-colors line-clamp-1 mb-1">
          {service.service_name}
        </h3>

        <p className="text-xs text-[var(--color-text-tertiary)] line-clamp-2 mb-4 flex-1">
          {service.description || `Professional ${service.category} service for your event.`}
        </p>

        <div className="flex items-center justify-between mt-auto pt-3 border-t border-[var(--color-border)]">
          <div className="flex items-center text-[var(--color-brand)] font-bold">
            <IndianRupee size={14} />
            <span>{service.base_price.toLocaleString()}</span>
            <span className="text-[10px] text-[var(--color-text-tertiary)] font-normal ml-1">
              /{service.price_unit === "per_event" ? "event" : "day"}
            </span>
          </div>

          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-[var(--color-text-tertiary)] hover:text-[var(--color-brand)]"
                onClick={() => onEdit(service)}
              >
                Edit
              </Button>
            )}
            {onDelete && service.id && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-[var(--color-text-tertiary)] hover:text-red-400"
                onClick={() => onDelete(service.id!)}
              >
                Delete
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-[var(--color-text-tertiary)]"
            >
              <ExternalLink size={14} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}