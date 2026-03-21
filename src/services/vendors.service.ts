import { supabase } from "@/services/supabase/client";
import { 
  type VendorServiceRow, 
  type CreateVendorServiceInput, 
  vendorServiceSchema, 
} from "@/schemas/vendor.schema";
import type { ApiResponse, PaginationParams, PaginatedResponse } from "@/schemas/common.schema";
import { logger } from "@/lib/logger";
import type { ExtendedServiceRequest } from "@/lib/supabase-types";

export const vendorsService = {
  /**
   * Retrieves all services offered by a specific vendor.
   */
  async getVendorServices(vendorId: string, params: PaginationParams): Promise<ApiResponse<PaginatedResponse<VendorServiceRow>>> {
    try {
      const { page = 1, limit = 10 } = params;
      const offset = (page - 1) * limit;

      const { data, count, error } = await supabase
        .from("vendor_services")
        .select("*", { count: "exact" })
        .eq("vendor_id", vendorId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw new Error(error.message);

      // Validate data through Zod array schema mapping
      const validatedData = data.map((item) => vendorServiceSchema.parse(item));

      return {
        success: true,
        data: {
          items: validatedData,
          total: count || 0,
          page,
          limit,
          hasMore: (count || 0) > offset + limit
        }
      };
    } catch (error) {
      logger.error("[vendorsService.getVendorServices]", error);
      return { success: false, error: { message: error instanceof Error ? error.message : "Unknown error", code: "FETCH_SERVICES_FAILED" } };
    }
  },

  /**
   * Creates a new strictly typed vendor service.
   */
  async createService(input: CreateVendorServiceInput): Promise<ApiResponse<VendorServiceRow>> {
    try {
      // Validate input against our service schema
      vendorServiceSchema.parse(input);

      const { data, error } = await supabase
        .from("vendor_services")
        .insert(input)
        .select()
        .single();

      if (error) throw new Error(error.message);

      return { success: true, data: data as VendorServiceRow };
    } catch (error) {
      logger.error("[vendorsService.createService]", error);
      return { success: false, error: { message: error instanceof Error ? error.message : "Unknown error", code: "CREATE_SERVICE_FAILED" } };
    }
  },

  /**
   * Updates an existing service with Zod payload validation.
   */
  async updateService(serviceId: string, input: Partial<CreateVendorServiceInput>): Promise<ApiResponse<VendorServiceRow>> {
    try {
      const { data, error } = await supabase
        .from("vendor_services")
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq("id", serviceId)
        .select()
        .single();

      if (error) throw new Error(error.message);

      return { success: true, data: vendorServiceSchema.parse(data) };
    } catch (error) {
      logger.error("[vendorsService.updateService]", error);
      return { success: false, error: { message: error instanceof Error ? error.message : "Unknown error", code: "UPDATE_SERVICE_FAILED" } };
    }
  },

  /**
   * Soft delete or hard delete the service based on configuration.
   * (Hard delete by default since Service Requests enforce FK cascades if needed).
   */
  async deleteService(serviceId: string): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase
        .from("vendor_services")
        .delete()
        .eq("id", serviceId);

      if (error) throw new Error(error.message);

      return { success: true };
    } catch (error) {
      logger.error("[vendorsService.deleteService]", error);
      return { success: false, error: { message: error instanceof Error ? error.message : "Unknown error", code: "DELETE_SERVICE_FAILED" } };
    }
  },

  /**
   * Get marketplace services for browsing and discovery.
   */
  async searchMarketplace(params: PaginationParams & { category?: string }): Promise<ApiResponse<PaginatedResponse<VendorServiceRow>>> {
    try {
      const { page = 1, limit = 20, category } = params;
      const offset = (page - 1) * limit;

      let query = supabase
        .from("vendor_services")
        .select("*", { count: "exact" });

      if (category) {
        query = query.eq("category", category);
      }

      const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw new Error(error.message);

      return {
        success: true,
        data: {
          items: data as VendorServiceRow[],
          total: count || 0,
          page,
          limit,
          hasMore: (count || 0) > offset + limit
        }
      };
    } catch (error) {
      logger.error("[vendorsService.searchMarketplace]", error);
      return { success: false, error: { message: error instanceof Error ? error.message : "Unknown error", code: "MARKETPLACE_SEARCH_FAILED" } };
    }
  },

  /**
   * Fetch service requests for a specific role (customer or vendor)
   */
  async getRequests(role: "customer" | "vendor", userId: string): Promise<ApiResponse<ExtendedServiceRequest[]>> {
    try {
      const matchColumn = role === "customer" ? "requester_id" : "vendor_id";
      
      const { data: reqs, error } = await supabase
        .from("service_requests")
        .select(`
          *,
          events (event_name, start_date),
          vendor_services (service_name, base_price)
        `)
        .eq(matchColumn, userId)
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);

      const otherPartyCol = role === "customer" ? "vendor_id" : "requester_id";
      const profileIds = [...new Set(reqs.map((r) => r[otherPartyCol]).filter(Boolean))];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", profileIds);

      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

      const extended = reqs.map((r) => ({
        ...r,
        events: Array.isArray(r.events) ? r.events[0] : r.events || null,
        vendor_services: Array.isArray(r.vendor_services) ? r.vendor_services[0] : r.vendor_services || null,
        profiles: profileMap.get(r[otherPartyCol]) ?? { full_name: "Unknown", email: "" },
      })) as ExtendedServiceRequest[];

      return { success: true, data: extended };
    } catch (error) {
      logger.error("[vendorsService.getRequests]", error);
      return { success: false, error: { message: error instanceof Error ? error.message : "Unknown error", code: "FETCH_REQUESTS_FAILED" } };
    }
  },

  /**
   * Update the status of a service request
   */
  async updateRequestStatus(requestId: string, status: "accepted" | "rejected" | "cancelled" | "completed"): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase
        .from("service_requests")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", requestId);

      if (error) throw new Error(error.message);

      return { success: true };
    } catch (error) {
      logger.error("[vendorsService.updateRequestStatus]", error);
      return { success: false, error: { message: error instanceof Error ? error.message : "Unknown error", code: "UPDATE_STATUS_FAILED" } };
    }
  }
};
