"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { VendorService, Event } from "@/lib/supabase-types";
import { Loader2, Search, Calendar, MessageSquare, X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { logError } from "@/lib/error-handler";

export default function VendorMarketplace() {
  const { userProfile } = useAuth();
  const { error: toastError, success: toastSuccess, Toast } = useToast();
  const [services, setServices] = useState<VendorService[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  
  // Booking Modal State
  const [selectedService, setSelectedService] = useState<VendorService | null>(null);
  const [userEvents, setUserEvents] = useState<Event[]>([]);
  const [bookingMessage, setBookingMessage] = useState("");
  const [selectedEventId, setSelectedEventId] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from("vendor_services")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error("Error fetching services:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserEvents = useCallback(async () => {
    try {
      const today = new Date().toISOString();
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("user_email", userProfile?.email)
        .gte("start_date", today) // Only upcoming events
        .order("start_date", { ascending: true });

      if (error) throw error;
      setUserEvents(data || []);
      if (data && data.length > 0) {
        setSelectedEventId(data[0].id);
      }
    } catch (error) {
      console.error("Error fetching events:", error);
    }
  }, [userProfile?.email]);

  useEffect(() => {
    fetchServices();
  }, []);

  useEffect(() => {
    if (selectedService && userProfile?.id) {
      fetchUserEvents();
    }
  }, [selectedService, userProfile?.id, fetchUserEvents]);

  const handleBookService = async () => {
    if (!selectedService || !selectedEventId || !userProfile?.id) return;
    setBookingLoading(true);

    try {
      const { error } = await supabase
        .from("service_requests")
        .insert([
          {
            event_id: selectedEventId,
            service_id: selectedService.id,
            requester_id: userProfile.id,
            vendor_id: selectedService.vendor_id,
            status: 'pending',
            message: bookingMessage
          }
        ]);

      if (error) throw error;
      
      toastSuccess("Request sent successfully!");
      setSelectedService(null);
      setBookingMessage("");
    } catch (error) {
      logError("bookService", error);
      toastError("Failed to send request. Please try again.");
    } finally {
      setBookingLoading(false);
    }
  };

  const filteredServices = services.filter(service => {
    const matchesSearch = service.service_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          service.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "All" || service.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = ["All", ...Array.from(new Set(services.map(s => s.category).filter(Boolean)))];

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-zinc-500" /></div>;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <input
            type="text"
            placeholder="Search services..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
        >
          {categories.map(cat => (
            <option key={cat} value={cat as string}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Services Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredServices.map((service) => (
          <div key={service.id} className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden hover:border-zinc-700 transition-all group flex flex-col">
            <div className="p-5 flex-1">
              <div className="flex justify-between items-start mb-3">
                <span className="px-2 py-1 text-xs font-medium text-primary bg-primary/10 rounded-full">
                  {service.category}
                </span>
                <span className="text-lg font-bold text-white">
                  ${service.base_price}
                </span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">{service.service_name}</h3>
              <p className="text-zinc-400 text-sm line-clamp-3 mb-4">{service.description}</p>
            </div>
            <div className="p-4 bg-zinc-950/50 border-t border-zinc-800">
              <button
                onClick={() => setSelectedService(service)}
                className="w-full py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                Request Service
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredServices.length === 0 && (
        <div className="text-center py-12 text-zinc-500">
          No services found matching your criteria.
        </div>
      )}

      {/* Booking Modal */}
      {selectedService && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-2xl overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
              <h3 className="text-xl font-semibold text-white">Request Service</h3>
              <button 
                onClick={() => setSelectedService(null)} 
                className="text-zinc-400 hover:text-white transition-colors p-1 hover:bg-zinc-800 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800">
                <h4 className="font-medium text-white">{selectedService.service_name}</h4>
                <p className="text-sm text-zinc-400 mt-1">Base Price: ${selectedService.base_price}</p>
              </div>

              {userEvents.length > 0 ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1">Select Event</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                      <select
                        value={selectedEventId}
                        onChange={(e) => setSelectedEventId(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none appearance-none"
                      >
                        {userEvents.map(event => (
                          <option key={event.id} value={event.id}>
                            {event.event_name} ({new Date(event.start_date).toLocaleDateString()})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1">Message to Vendor</label>
                    <div className="relative">
                      <MessageSquare className="absolute left-3 top-3 text-zinc-500" size={16} />
                      <textarea
                        value={bookingMessage}
                        onChange={(e) => setBookingMessage(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-10 pr-4 py-3 text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none h-40 resize-none"
                        placeholder="Describe your requirements..."
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleBookService}
                    disabled={bookingLoading}
                    className="w-full py-3 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {bookingLoading ? <Loader2 className="animate-spin" /> : "Send Request"}
                  </button>
                </>
              ) : (
                <div className="text-center py-6 text-zinc-400">
                  <p>You don&apos;t have any upcoming events to book this service for.</p>
                  <p className="text-sm mt-2">Create an event first!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <Toast />
    </div>
  );
}
