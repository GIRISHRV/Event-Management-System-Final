"use client";

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useVendorServices } from "@/hooks/useVendors";
import { vendorsService } from "@/services/vendors.service";
import type { VendorServiceRow } from "@/schemas/vendor.schema";

import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardToolbar, VENDOR_TABS } from "@/components/dashboard/DashboardToolbar";
import { DashboardRequestsList } from "@/components/dashboard/DashboardRequestsList";
import VendorServicesManager from "@/components/vendor/VendorServicesManager";
import Link from "next/link";
import { TrendingUp, Users, ArrowUpRight, MapPin, Calendar } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/services/supabase/client";
import VendorServiceForm from "@/components/vendor/VendorServiceForm";
import { Drawer } from "@/components/ui/Drawer";
import { useToast } from "@/hooks/useToast";

interface CommunityInsight {
  communityId: string;
  label: string;
  eventIds: string[];
  characteristics: string[];
}

interface TrendingEvent {
  id: string;
  event_name: string;
  start_date: string;
  venue_city: string | null;
  attendee_count: number | null;
}

export default function VendorDashboardPage() {
  const { session, userProfile, loading } = useAuth();
  const { error: toastError, success: toastSuccess } = useToast();

  const [activeTab, setActiveTab] = useState<string>("services");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingService, setEditingService] = useState<VendorServiceRow | undefined>(undefined);
  const [insightData, setInsightData] = useState<{
    communities: CommunityInsight[];
    trendingEvents: TrendingEvent[];
    loading: boolean;
  }>({ communities: [], trendingEvents: [], loading: false });

  const userId = session?.user?.id;

  const { services, isLoading: servicesLoading, mutate: mutateServices } = useVendorServices(userId, { page: 1, limit: 50 });

  const handleDeleteService = useCallback(async (serviceId: string) => {
    try {
      const result = await vendorsService.deleteService(serviceId);
      if (!result.success) throw new Error(result.error?.message);
      toastSuccess("Service deleted successfully!");
      mutateServices();
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : "Failed to delete service");
    }
  }, [mutateServices, toastSuccess, toastError]);

  const handleEditService = (service: VendorServiceRow) => {
    setEditingService(service);
    setIsFormOpen(true);
  };

  const openCreateForm = () => {
    setEditingService(undefined);
    setIsFormOpen(true);
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setEditingService(undefined);
    mutateServices();
  };

  const router = useRouter();

  useEffect(() => {
    if (activeTab === "insights") {
      const fetchInsights = async () => {
        setInsightData(prev => ({ ...prev, loading: true }));
        try {
          // 1. Fetch communities (GAT+K-Means output)
          const commRes = await fetch("/api/algorithms/communities");
          const commData = await commRes.json();
          
          // 2. Fetch trending events (iTransformer "increasing" trend)
          const { data: trending } = await supabase
            .from("attendance_forecasts")
            .select("event_id")
            .eq("trend", "increasing")
            .limit(20);
          
          let trendingEvents: TrendingEvent[] = [];
          if (trending && trending.length > 0) {
            const eventIds = [...new Set(trending.map(t => t.event_id))];
            const { data: events } = await supabase
              .from("events")
              .select("id, event_name, start_date, venue_city, attendee_count")
              .in("id", eventIds)
              .limit(5);
            trendingEvents = (events as TrendingEvent[]) || [];
          }

          setInsightData({
            communities: (commData.communities?.slice(0, 4) as CommunityInsight[]) || [],
            trendingEvents,
            loading: false
          });
        } catch {
          setInsightData(prev => ({ ...prev, loading: false }));
        }
      };
      fetchInsights();
    }
  }, [activeTab]);

  useEffect(() => {
    if (!loading && (!session || userProfile?.role !== "vendor")) {
      router.push("/signin");
    }
  }, [loading, session, userProfile, router]);

  if (loading || (session && !userProfile)) return <LoadingScreen />;
  if (!session || userProfile?.role !== "vendor") return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <DashboardHeader
        title={`Welcome back, ${userProfile?.full_name || 'Vendor'}`}
        subtitle="Manage your services and respond to incoming customer requests."
        onPrimaryAction={activeTab === 'services' ? openCreateForm : undefined}
        primaryActionLabel="Add Service"
      />

      <DashboardToolbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabs={VENDOR_TABS}
      />

      <div className="bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--color-border)] p-6 animate-in fade-in slide-in-from-bottom-2 duration-300 min-h-[600px]">
        {activeTab === "services" && (
          <VendorServicesManager
            services={services}
            isLoading={servicesLoading}
            onDelete={handleDeleteService}
            onEdit={handleEditService}
          />
        )}

        {activeTab === "requests" && (
          <DashboardRequestsList role="vendor" />
        )}

        {activeTab === "insights" && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Communities Section */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
                  <Users size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight">Top Active Communities</h3>
                  <p className="text-sm text-[var(--color-text-tertiary)]">Reach concentrated groups of engaged event planners.</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {insightData.loading ? (
                   [...Array(4)].map((_, i) => <Card key={i} className="h-32 animate-pulse bg-[var(--color-surface-hover)]" />)
                ) : insightData.communities.map((c, i) => (
                  <Card key={i} className="p-5 border-[var(--color-border)] hover:border-purple-500/50 transition-colors group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Users size={48} />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-purple-500 mb-2">Cluster {c.communityId}</p>
                    <h4 className="font-bold text-[var(--color-text-primary)] mb-1">{c.label}</h4>
                    <p className="text-xs text-[var(--color-text-secondary)]">{c.eventIds.length} Active Events</p>
                    <div className="mt-4 flex gap-1 flex-wrap">
                      {c.characteristics.slice(0, 2).map((char, idx) => (
                        <Badge key={idx} variant="secondary" className="text-[9px] px-1.5 py-0 h-4">{char}</Badge>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Trending Events Section */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                  <TrendingUp size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight">Trending Events</h3>
                  <p className="text-sm text-[var(--color-text-tertiary)]">Upcoming events with high predicted growth (iTransformer).</p>
                </div>
              </div>

              <div className="space-y-3">
                {insightData.loading ? (
                   [...Array(3)].map((_, i) => <Card key={i} className="h-20 animate-pulse bg-[var(--color-surface-hover)]" />)
                ) : insightData.trendingEvents.length === 0 ? (
                  <div className="py-12 text-center border-2 border-dashed border-[var(--color-border)] rounded-3xl">
                    <p className="text-[var(--color-text-tertiary)] text-sm italic">No high-growth events identified this hour.</p>
                  </div>
                ) : insightData.trendingEvents.map((e, i) => (
                  <Link key={i} href={`/event/${e.id}`} className="block group">
                    <Card className="p-4 flex items-center justify-between border-[var(--color-border)] hover:border-emerald-500/50 hover:bg-emerald-500/[0.02] transition-all">
                      <div className="flex items-center gap-6">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center text-emerald-600 border border-emerald-500/10">
                          <TrendingUp size={20} />
                        </div>
                        <div>
                          <h4 className="font-bold text-[var(--color-text-primary)] group-hover:text-emerald-500 transition-colors uppercase tracking-tight">{e.event_name}</h4>
                          <div className="flex items-center gap-4 mt-1 text-[11px] text-[var(--color-text-tertiary)] font-medium">
                             <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(e.start_date).toLocaleDateString()}</span>
                             <span className="flex items-center gap-1"><MapPin size={12} /> {e.venue_city}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-6">
                        <div>
                          <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest leading-none mb-1">Status</p>
                          <Badge variant="success" className="bg-emerald-500/10 text-emerald-500 border-none h-5 px-2 text-[10px] font-bold">Increasing</Badge>
                        </div>
                        <ArrowUpRight size={18} className="text-[var(--color-text-tertiary)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <Drawer
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingService(undefined);
        }}
        title={editingService ? "Edit Service" : "Create Service"}
        description={editingService ? "Update your service details." : "Add a new service for event organizers to discover."}
        size="lg"
      >
        <VendorServiceForm
          onClose={() => {
            setIsFormOpen(false);
            setEditingService(undefined);
          }}
          onSuccess={handleFormSuccess}
          initialData={editingService}
        />
      </Drawer>
    </div>
  );
}