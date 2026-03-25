"use client";

import { useState } from "react";
import useSWR from "swr";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/useToast";
import { logger } from "@/lib/logger";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Inbox, Check, X as XIcon, Calendar, DollarSign, Store, AlertTriangle, User } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { vendorsService } from "@/services/vendors.service";
import type { ExtendedServiceRequest as DashboardRequest } from "@/lib/supabase-types";

interface DashboardRequestsListProps {
  role: "customer" | "vendor";
}

export function DashboardRequestsList({ role }: DashboardRequestsListProps) {
  const { userProfile } = useAuth();
  const { error: toastError, success: toastSuccess } = useToast();

  const [cancelTarget, setCancelTarget] = useState<string | null>(null);

  const swrKey = userProfile?.id ? ["dashboard-requests", userProfile.id, role] : null;

  const { data: requests = [], isLoading, mutate } = useSWR<DashboardRequest[]>(
    swrKey,
    async () => {
      const response = await vendorsService.getRequests(role, userProfile!.id);
      if (!response.success) throw new Error(response.error?.message);
      return response.data as DashboardRequest[];
    },
    { onError: (err) => logger.error("Failed to fetch requests", err) }
  );

  const updateStatus = async (id: string, newStatus: "accepted" | "rejected" | "cancelled") => {
    // Optimistic update
    mutate((prev) => prev?.map((r) => r.id === id ? { ...r, status: newStatus } : r), false);
    
    try {
      const response = await vendorsService.updateRequestStatus(id, newStatus);
      if (!response.success) throw new Error(response.error?.message);
      
      toastSuccess(`Request ${newStatus} successfully.`);
      mutate();
    } catch {
      toastError("Action failed. Please try again.");
      mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4 space-y-4 shadow-sm">
            <Skeleton className="h-6 w-48 rounded" />
            <Skeleton className="h-16 w-full rounded-[var(--radius-md)]" />
          </div>
        ))}
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="Inbox Zero"
        description={
          role === "customer"
            ? "Service requests you send to vendors will appear here."
            : "Incoming requests from customers will appear here."
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <Modal
        type="confirm"
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title="Cancel Request"
        variant="danger"
        confirmLabel="Cancel Booking"
        onConfirm={() => {
          if (cancelTarget) updateStatus(cancelTarget, "cancelled");
          setCancelTarget(null);
        }}
      >
        <p className="text-[var(--color-text-secondary)]">
          Are you sure you want to cancel this booking? This cannot be undone.
        </p>
      </Modal>

      {requests.map((request) => {
        const title = role === "customer" ? request.vendor_services?.service_name : request.events?.event_name;
        
        return (
          <Card key={request.id} className="group bg-[var(--color-surface)] border-[var(--color-border)] shadow-sm hover:border-[var(--color-brand)]/40 transition-all duration-300">
            <CardHeader className="pb-3 border-b border-[var(--color-border)]">
              <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                      {title || "Pending Service"}
                    </h3>
                    <Badge variant={
                      request.status === 'accepted' ? 'success' :
                      request.status === 'rejected' ? 'danger' :
                      request.status === 'cancelled' ? 'secondary' : 'warning'
                    } className="capitalize px-2 py-0.5 text-xs">
                      {request.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs font-medium text-[var(--color-text-secondary)]">
                    <div className="flex items-center gap-1.5">
                      {role === "customer" ? <Store size={14} className="text-[var(--color-brand)]" /> : <User size={14} className="text-[var(--color-brand)]" />}
                      <span>{request.profiles?.full_name}</span>
                    </div>
                    {request.events && (
                      <div className="flex items-center gap-1.5">
                        <Calendar size={14} className="text-[var(--color-brand)]" />
                        <span>{new Date(request.events.start_date).toLocaleDateString()}</span>
                      </div>
                    )}
                    {request.vendor_services && (
                      <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[var(--color-background)] rounded-full border border-[var(--color-border)]">
                        <DollarSign size={12} className="text-[var(--color-text-primary)]" />
                        <span className="text-[var(--color-text-primary)] font-semibold">{request.vendor_services.base_price}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 pb-0">
              <div className="bg-[var(--color-background)] p-4 rounded-[var(--radius-md)] border border-[var(--color-border)]/50">
                <p className="text-xs text-[var(--color-text-tertiary)] uppercase tracking-wider font-semibold mb-2">
                  Message
                </p>
                <p className="text-[var(--color-text-primary)] text-sm italic">
                  &quot;{request.message || "No specific instructions provided."}&quot;
                </p>
              </div>
            </CardContent>

            <CardFooter className="pt-4 flex items-center justify-end gap-3 mt-2">
              {request.status === "pending" && role === "vendor" && (
                <>
                  <Button variant="outline" size="sm" className="border-[var(--color-danger)] text-[var(--color-danger)] hover:bg-[var(--color-danger-muted)]" onClick={() => updateStatus(request.id, "rejected")}>
                    <XIcon className="w-4 h-4 mr-1" /> Decline
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => updateStatus(request.id, "accepted")}>
                    <Check className="w-4 h-4 mr-1" /> Accept Request
                  </Button>
                </>
              )}

              {request.status === "pending" && role === "customer" && (
                <Button variant="outline" size="sm" onClick={() => setCancelTarget(request.id)}>
                  Withdraw Request
                </Button>
              )}

              {request.status === "accepted" && (
                <Button variant="outline" size="sm" className="border-[var(--color-danger)]/50 text-[var(--color-danger)] hover:bg-[var(--color-danger-muted)]" onClick={() => setCancelTarget(request.id)}>
                  <AlertTriangle className="w-4 h-4 mr-1" /> Cancel Booking
                </Button>
              )}
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
