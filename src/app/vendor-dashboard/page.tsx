"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { VendorService } from "@/lib/supabase-types";
import PillNav from "@/components/layout/PillNav";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import VendorServicesManager from "@/components/vendor/VendorServicesManager";
import VendorRequestsList from "@/components/vendor/VendorRequestsList";
import VendorServiceForm from "@/components/vendor/VendorServiceForm";
import { VendorDashboardHeader } from "@/components/vendor/VendorDashboardHeader";
import { VendorDashboardToolbar } from "@/components/vendor/VendorDashboardToolbar";
import Squares from "@/components/ui/Squares";
import { X } from "lucide-react";

export default function VendorDashboardPage() {
  const router = useRouter();
  const { session, userProfile, loading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<'services' | 'requests'>('services');
  const [isAddingService, setIsAddingService] = useState(false);
  const [editingService, setEditingService] = useState<VendorService | undefined>(undefined);
  const [services, setServices] = useState<VendorService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [isAIOpen, setIsAIOpen] = useState(false);

  // Fake loading delay constant
  const MIN_LOADING_TIME = 1500;

  useEffect(() => {
    if (!loading) {
      if (!session) {
        router.push("/signin");
      } else if (userProfile && userProfile.role !== "vendor") {
        router.push("/customer-dashboard");
      } else {
        // Apply vendor theme
        document.body.classList.add('theme-vendor');
        document.body.classList.remove('theme-customer');
      }
    }
    return () => {
      document.body.classList.remove('theme-vendor');
    };
  }, [session, userProfile, loading, router]);

  const fetchServices = useCallback(async () => {
    if (!userProfile?.id) return;
    
    setServicesLoading(true);
    const startTime = Date.now();

    try {
      const { data, error } = await supabase
        .from("vendor_services")
        .select("*")
        .eq("vendor_id", userProfile.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error("Error fetching services:", error);
    } finally {
      // Ensure minimum loading time
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, MIN_LOADING_TIME - elapsed);
      setTimeout(() => setServicesLoading(false), remaining);
    }
  }, [userProfile?.id]);

  useEffect(() => {
    if (userProfile?.id && activeTab === 'services') {
      fetchServices();
    }
  }, [userProfile?.id, activeTab, fetchServices]);

  const handleDeleteService = async (id: string) => {
    if (!confirm("Are you sure you want to delete this service?")) return;

    try {
      const { error } = await supabase
        .from("vendor_services")
        .delete()
        .eq("id", id);

      if (error) throw error;
      setServices(services.filter((s) => s.id !== id));
    } catch (error) {
      console.error("Error deleting service:", error);
    }
  };

  const handleEditService = (service: VendorService) => {
    setEditingService(service);
    setIsAddingService(true);
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const navItems = [
    { label: 'Home', href: '/' },
    { label: 'Events', href: '/events' },
    { label: 'Dashboard', href: '/vendor-dashboard' },
    { label: 'Profile', href: '/profile' }
  ];

  return (
    <div className="min-h-screen bg-zinc-950 relative overflow-hidden">
      <LoadingScreen message="Authenticating..." isLoading={loading || (!!session && !userProfile)} />
      
      {/* Animated Background */}
      <div className="fixed inset-0 z-0">
        <Squares
          direction="diagonal"
          speed={0.8}
          borderColor="rgba(99, 102, 241, 0.3)" // Indigo color for vendor theme
          squareSize={40}
          hoverFillColor="rgba(99, 102, 241, 0.1)"
        />
      </div>
      
      {session && userProfile?.role === "vendor" && (
        <>
          {/* Navigation */}
          <PillNav
            items={navItems}
            activeHref="/vendor-dashboard"
            userEmail={session?.user?.email}
            onSignOut={handleSignOut}
            showAuth={true}
          />

          {/* Content */}
          <div className="relative z-20 max-w-7xl mx-auto px-6 py-12 pt-24">
            
            <VendorDashboardHeader 
              activeTab={activeTab} 
              onCreateService={() => setIsAddingService(true)} 
            />

            <VendorDashboardToolbar 
              activeTab={activeTab} 
              onTabChange={(tab) => setActiveTab(tab as 'services' | 'requests')} 
            />

            {/* Tab Content */}
            <div className="mb-8 bg-zinc-950/90 backdrop-blur-sm rounded-xl border border-zinc-700 p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {activeTab === 'services' ? (
                <VendorServicesManager 
                  services={services}
                  isLoading={servicesLoading}
                  onDelete={handleDeleteService}
                  onEdit={handleEditService}
                />
              ) : (
                <VendorRequestsList />
              )}
            </div>
          </div>

          {/* Add Service Modal */}
          {isAddingService && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-200 backdrop-blur-sm overflow-x-auto">
              <div className={`flex items-stretch gap-6 transition-all duration-500 w-full max-w-[95vw] ${isAIOpen ? '' : 'justify-center'}`}>
                {/* AI Panel Slot */}
                <div 
                  id="ai-panel-slot" 
                  className={`shrink-0 transition-all duration-500 ease-in-out ${isAIOpen ? 'w-1/2 opacity-100 translate-x-0' : 'w-0 opacity-0 translate-x-10'}`}
                  style={{ overflow: 'hidden' }}
                />

                <div className={`bg-zinc-950 rounded-2xl max-h-[85vh] overflow-hidden flex flex-col border border-zinc-800 shadow-2xl animate-in fade-in zoom-in-95 transition-all duration-500 ease-in-out ${isAIOpen ? 'w-1/2' : 'w-full max-w-2xl'}`}>
                  <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                    <h3 className="text-xl font-semibold text-white">
                      {editingService ? 'Edit Service' : 'Add New Service'}
                    </h3>
                    <button 
                      onClick={() => {
                        setIsAddingService(false);
                        setEditingService(undefined);
                        setIsAIOpen(false);
                      }}
                      className="text-zinc-400 hover:text-white transition-colors p-1 hover:bg-zinc-800 rounded-lg"
                    >
                      <X size={24} />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <VendorServiceForm 
                      initialData={editingService}
                      onClose={() => {
                        setIsAddingService(false);
                        setEditingService(undefined);
                        setIsAIOpen(false);
                      }}
                      onSuccess={() => {
                        setIsAddingService(false);
                        setEditingService(undefined);
                        fetchServices();
                        setIsAIOpen(false);
                      }}
                      onAIStateChange={setIsAIOpen}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}


