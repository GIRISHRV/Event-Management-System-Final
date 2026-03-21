/**
 * Common Zod Schemas — Shared types used across all domains.
 *
 * RULES:
 * 1. All TypeScript types are DERIVED from Zod schemas using z.infer<>.
 * 2. Never define a standalone `type` or `interface` for data that crosses a boundary.
 * 3. Domain-specific schemas live in their own files (event.schema.ts, booking.schema.ts, etc.)
 */

import { z } from "zod";

// ─── Generic API Response ────────────────────────────────────────────────────

/**
 * Standard API response wrapper.
 * ALL API routes must return data in this shape.
 */
export const apiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z
      .object({
        message: z.string(),
        code: z.string().optional(),
        details: z.unknown().optional(),
      })
      .optional(),
  });

/** Legacy Alias */
export const commonApiResponseSchema = apiResponseSchema;

/** Convenience type for API responses */
export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: unknown;
  };
};

/** Helper to create a success response */
export function successResponse<T>(data: T): ApiResponse<T> {
  return { success: true, data };
}

/** Helper to create an error response */
export function errorResponse(
  message: string,
  code?: string,
  details?: unknown
): ApiResponse<never> {
  return { success: false, error: { message, code, details } };
}

// ─── Pagination ──────────────────────────────────────────────────────────────

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** Legacy Alias */
export const commonPaginationParamsSchema = paginationSchema;

export type PaginationParams = z.infer<typeof paginationSchema>;

export const paginatedResponseSchema = <T extends z.ZodTypeAny>(
  itemSchema: T
) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    hasMore: z.boolean(),
  });

export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
};

// ─── Sort ────────────────────────────────────────────────────────────────────

export const sortDirectionSchema = z.enum(["asc", "desc"]).default("asc");
export type SortDirection = z.infer<typeof sortDirectionSchema>;

// ─── ID Param ────────────────────────────────────────────────────────────────

export const idParamSchema = z.object({
  id: z.string().uuid("Invalid ID format"),
});

export type IdParam = z.infer<typeof idParamSchema>;

// ─── Timestamps ──────────────────────────────────────────────────────────────

export const timestampsSchema = z.object({
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
});

export type Timestamps = z.infer<typeof timestampsSchema>;

// ─── User Role ───────────────────────────────────────────────────────────────

export const userRoleSchema = z.enum(["customer", "vendor", "admin"]);
export type UserRole = z.infer<typeof userRoleSchema>;
