"use client";

import { usePublicEvents } from "@/hooks/useEvents";
import { EventList } from "@/components/events/EventList";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { BackgroundEffects } from "@/components/ui/BackgroundEffects";
import { Input } from "@/components/ui/Input";
import { Search } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { CommunityFilter } from "@/components/events/CommunityFilter";
import { useCallback } from "react";

export default function PublicEventsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  // Get events using our event management system
  const { events, isLoading } = usePublicEvents({ page: 1, limit: 100 });

  const [communityFilterIds, setCommunityFilterIds] = useState<string[] | null>(null);

  const handleCommunityFilter = useCallback((ids: string[] | null) => {
    setCommunityFilterIds(ids);
  }, []);

  // Compute filtering natively on-client for sub-100msec responsiveness
  const filteredEvents = events.filter((grid) => {
    const matchesSearch = (grid.event_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (grid.venue_city || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCommunity = !communityFilterIds || communityFilterIds.includes(grid.id);
    return matchesSearch && matchesCommunity;
  });

  return (
    <div className="min-h-screen bg-[var(--color-background)] relative overflow-x-hidden flex flex-col">
      <BackgroundEffects variant="squares" className="opacity-40" />
      <Navbar />

      <main className="flex-1 relative z-10">
        
        {/* Page Header */}
        <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-lg pt-24 pb-12">
          <div className="max-w-7xl mx-auto px-6 flex flex-col items-center text-center">
            <h1 className="text-4xl md:text-5xl font-extrabold text-[var(--color-text-primary)] tracking-tight mb-4">
              Discover <span className="text-[var(--color-brand)]">Upcoming Events</span>
            </h1>
            <p className="text-lg text-[var(--color-text-secondary)] max-w-2xl text-balance">
              Discover upcoming events in your area. Find the perfect event that matches your interests and connect with your community.
            </p>

            <div className="mt-8 w-full max-w-md relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] w-5 h-5 group-focus-within:text-[var(--color-brand)] transition-colors" />
              <Input
                type="text"
                placeholder="Search events by name or city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  "w-full h-12 pl-12 pr-4 text-base bg-[var(--color-background)] rounded-[var(--radius-full)]",
                  "border border-[var(--color-border)] focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/20",
                  "shadow-sm transition-all text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
                )}
              />
            </div>
          </div>
        </div>

        {/* Events Section */}
        <div className="max-w-7xl mx-auto px-6 py-12 space-y-8">
          <CommunityFilter onFilter={handleCommunityFilter} />
          
          <EventList
            events={filteredEvents}
            isLoading={isLoading}
            emptyTitle={searchQuery ? "No Events Found" : "No Events Available"}
            emptyDescription={searchQuery ? "No events match your search criteria." : "There are currently no public events available."}
          />
        </div>

      </main>
      
      <Footer />
    </div>
  );
}
