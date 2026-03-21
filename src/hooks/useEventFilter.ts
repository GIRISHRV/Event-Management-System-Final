"use client";

import { useMemo } from "react";

export interface FilterableEvent {
    event_name: string;
    event_description?: string | null;
    venue_city?: string | null;
    start_date?: string | null;
    [key: string]: unknown;
}

export interface EventFilterOptions {
    searchTerm: string;
    locationFilter: string;
    dateFilter: string;
}

/**
 * Filters a list of events based on search term, location, and date.
 * Single source of truth for event filtering — eliminates duplicated logic
 * across PublicEventListWithFavorites, EventListWithActions, and events/page.tsx.
 */
export function useEventFilter<T extends FilterableEvent>(
    events: T[],
    { searchTerm, locationFilter, dateFilter }: EventFilterOptions
): T[] {
    return useMemo(() => {
        return events.filter((event) => {
            // Search filter — matches name or description
            if (searchTerm) {
                const q = searchTerm.toLowerCase();
                const matchesName = event.event_name.toLowerCase().includes(q);
                const matchesDesc = event.event_description?.toLowerCase().includes(q) ?? false;
                if (!matchesName && !matchesDesc) return false;
            }

            // Location filter
            if (locationFilter && locationFilter !== "all") {
                if (event.venue_city !== locationFilter) return false;
            }

            // Date filter
            if (dateFilter && dateFilter !== "all" && event.start_date) {
                const eventDate = new Date(event.start_date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                if (dateFilter === "upcoming") {
                    if (eventDate < today) return false;
                } else if (dateFilter === "past") {
                    if (eventDate >= today) return false;
                } else if (dateFilter === "this-week") {
                    const weekEnd = new Date(today);
                    weekEnd.setDate(weekEnd.getDate() + 7);
                    if (eventDate < today || eventDate > weekEnd) return false;
                } else if (dateFilter === "this-month") {
                    if (
                        eventDate.getMonth() !== today.getMonth() ||
                        eventDate.getFullYear() !== today.getFullYear()
                    ) {
                        return false;
                    }
                }
            }

            return true;
        });
    }, [events, searchTerm, locationFilter, dateFilter]);
}
