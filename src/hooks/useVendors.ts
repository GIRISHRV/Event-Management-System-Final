"use client";

import useSWR from "swr";
import { vendorsService } from "@/services/vendors.service";
import type { PaginationParams } from "@/schemas/common.schema";

interface UseVendorsOptions extends PaginationParams {
  category?: string;
}

export function useVendorServices(vendorId: string | undefined, params: PaginationParams = { page: 1, limit: 10 }) {
  const { data, error, isLoading, mutate } = useSWR(
    vendorId ? ["vendor_services", vendorId, params] : null,
    async () => {
      if (!vendorId) return null;
      const response = await vendorsService.getVendorServices(vendorId, params);
      if (!response.success) throw new Error(response.error?.message);
      return response.data;
    },
    { revalidateOnFocus: false }
  );

  return {
    services: data?.items || [],
    total: data?.total || 0,
    hasMore: data?.hasMore || false,
    isLoading,
    error: error as Error | undefined,
    mutate,
  };
}

export function useMarketplace(options: UseVendorsOptions = { page: 1, limit: 20 }) {
  const { data, error, isLoading, mutate } = useSWR(
    ["marketplace", options],
    async () => {
      const response = await vendorsService.searchMarketplace(options);
      if (!response.success) throw new Error(response.error?.message);
      return response.data;
    },
    { revalidateOnFocus: false }
  );

  return {
    marketplaceItems: data?.items || [],
    total: data?.total || 0,
    hasMore: data?.hasMore || false,
    isLoading,
    error: error as Error | undefined,
    mutate,
  };
}
