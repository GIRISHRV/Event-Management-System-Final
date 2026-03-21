import { z } from "zod";

// ─── Vendor Categories ─────────────

// Vendor service categories for easy organization
export const vendorCategoryEnum = z.enum([
  "catering",
  "photography",
  "videography",
  "decoration",
  "entertainment",
  "security",
  "venue",
  "logistics",
  "other" // general category
]);
export type VendorCategory = z.infer<typeof vendorCategoryEnum>;

// Service request statuses for tracking progress
export const requestStatusEnum = z.enum([
  "pending",
  "accepted",
  "rejected",
  "completed",
  "cancelled"
]);
export type RequestStatus = z.infer<typeof requestStatusEnum>;

// ─── Core Schema Definitions ───────────────────────────────

export const vendorServiceSchema = z.object({
  id: z.string().uuid().optional(), // optional for creates
  vendor_id: z.string().uuid(),
  service_name: z.string().min(3, "Service name must be at least 3 characters").max(100),
  description: z.string().max(1000).optional().nullable(),
  
  // Pricing information
  base_price: z.number()
    .min(0, "Price must be positive")
    .max(9999999, "Price exceeds maximum allowed"),
  price_unit: z.enum(["per_hour", "per_event", "per_guest", "fixed"]).default("fixed"),
  category: vendorCategoryEnum.default("other"),
  
  // Service quality metrics (optional for now)
  quality_score: z.number().min(0).max(100).nullable().optional(),
  rating: z.number().min(0).max(5).nullable().optional(),
  capacity: z.number().min(1).max(50000).nullable().optional(), // service capacity
  
  images: z.array(z.string().url()).max(5).optional().nullable(),
  created_at: z.string().datetime({ offset: true }).optional(),
  updated_at: z.string().datetime({ offset: true }).optional().nullable(),
});

export type VendorServiceRow = z.infer<typeof vendorServiceSchema>;
export type CreateVendorServiceInput = Omit<VendorServiceRow, "id" | "created_at" | "updated_at">;

export const serviceRequestSchema = z.object({
  id: z.string().uuid().optional(),
  event_id: z.string().uuid(),
  service_id: z.string().uuid(),
  requester_id: z.string().uuid(),
  vendor_id: z.string().uuid(),
  
  status: requestStatusEnum.default("pending"),
  message: z.string().max(2000).optional().nullable(),
  
  // Auditing trail
  cancellation_requested_by: z.enum(["customer", "vendor"]).nullable().optional(),
  
  created_at: z.string().datetime({ offset: true }).optional(),
  updated_at: z.string().datetime({ offset: true }).optional().nullable(),
});

export type ServiceRequestRow = z.infer<typeof serviceRequestSchema>;
