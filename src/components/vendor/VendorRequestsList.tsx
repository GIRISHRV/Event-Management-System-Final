"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { ServiceRequest } from "@/lib/supabase-types";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { logError } from "@/lib/error-handler";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Inbox, Check, X as XIcon, Mail, Calendar, DollarSign, User } from "lucide-react";

// Extended type for the join
type ExtendedRequest = ServiceRequest & {
  events: {
    event_name: string;
    start_date: string;
  };
  vendor_services: {
    service_name: string;
    base_price: number;
  };
  profiles: {
    full_name: string;
    email: string;
  };
};

export default function VendorRequestsList() {
  const { userProfile } = useAuth();
  const { error: toastError, success: toastSuccess, Toast } = useToast();
  const [requests, setRequests] = useState<ExtendedRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Fake loading delay constant
  const MIN_LOADING_TIME = 1500;

  const fetchRequests = useCallback(async () => {
    if (!userProfile?.id) return;

    setLoading(true);
    const startTime = Date.now();

    try {
      const { data, error } = await supabase
        .from("service_requests")
        .select(`
          *,
          events (
            event_name,
            start_date
          ),
          vendor_services (
            service_name,
            base_price
          ),
          profiles:requester_id (
            full_name,
            email
          )
        `)
        .eq("vendor_id", userProfile.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRequests((data as unknown as ExtendedRequest[]) || []);
    } catch (error) {
      console.error("Error fetching requests:", error);
    } finally {
      // Ensure minimum loading time
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, MIN_LOADING_TIME - elapsed);
      setTimeout(() => setLoading(false), remaining);
    }
  }, [userProfile]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleStatusUpdate = async (id: string, newStatus: 'accepted' | 'rejected') => {
    try {
      const { error } = await supabase
        .from("service_requests")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;
      
      setRequests(requests.map(r => 
        r.id === id ? { ...r, status: newStatus } : r
      ));
      toastSuccess(`Request ${newStatus}`);
    } catch (error) {
      logError("updateRequestStatus", error);
      toastError("Failed to update status");
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'accepted': return 'success';
      case 'rejected': return 'destructive';
      case 'completed': return 'default';
      case 'cancelled': return 'secondary';
      default: return 'warning';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <Skeleton className="h-6 w-48 rounded" />
                <Skeleton className="h-4 w-32 rounded" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-20 w-full rounded-lg" />
            <div className="flex gap-4 pt-2">
              <Skeleton className="h-10 flex-1 rounded-lg" />
              <Skeleton className="h-10 flex-1 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No service requests"
        description="Requests will appear here when customers book your services."
      />
    );
  }

  return (
    <div className="space-y-4">
      {requests.map((request) => (
        <Card key={request.id} className="group hover:border-indigo-500/30 transition-all duration-300">
          <CardHeader className="pb-3">
            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-lg font-semibold text-white">
                    {request.events?.event_name || 'Unknown Event'}
                  </h3>
                  <Badge variant={getStatusBadgeVariant(request.status)} className="capitalize">
                    {request.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-zinc-400 mt-2">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={14} className="text-indigo-400" />
                    <span>{new Date(request.events?.start_date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <DollarSign size={14} className="text-green-400" />
                    <span>${request.vendor_services?.base_price}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <User size={14} className="text-blue-400" />
                    <span>{request.profiles?.full_name}</span>
                  </div>
                </div>
              </div>
              <div className="text-right hidden md:block">
                <div className="text-xs text-zinc-500">
                  Received {new Date(request.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pb-3">
            <div className="bg-zinc-950/50 p-4 rounded-lg border border-zinc-800/50">
              <p className="text-xs text-zinc-500 mb-2 font-medium uppercase tracking-wider">Request Details</p>
              <p className="text-zinc-300 text-sm italic">
                &quot;{request.message || 'No message provided'}&quot;
              </p>
              <div className="mt-3 pt-3 border-t border-zinc-800/50 flex items-center gap-2 text-sm text-zinc-400">
                <span className="text-zinc-500">Service:</span>
                <span className="text-indigo-300 font-medium">{request.vendor_services?.service_name}</span>
              </div>
            </div>
          </CardContent>

          <CardFooter className="pt-3 border-t border-zinc-800/50">
            {request.status === 'pending' ? (
              <div className="flex gap-3 w-full">
                <Button
                  onClick={() => handleStatusUpdate(request.id, 'accepted')}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
                >
                  <Check size={16} />
                  Accept Request
                </Button>
                <Button
                  onClick={() => handleStatusUpdate(request.id, 'rejected')}
                  variant="outline"
                  className="flex-1 border-zinc-700 hover:bg-zinc-800 text-zinc-300 gap-2"
                >
                  <XIcon size={16} />
                  Decline
                </Button>
              </div>
            ) : request.status === 'accepted' ? (
              <div className="w-full bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3 flex items-center justify-center gap-2 text-indigo-300 text-sm">
                <Mail size={16} />
                <span>Contact organizer: <a href={`mailto:${request.profiles?.email}`} className="underline hover:text-indigo-200">{request.profiles?.email}</a></span>
              </div>
            ) : (
              <div className="w-full text-center text-sm text-zinc-500 py-2">
                This request has been {request.status}
              </div>
            )}
          </CardFooter>
        </Card>
      ))}
      <Toast />
    </div>
  );
}
