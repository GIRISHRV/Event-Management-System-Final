"use client";

import { useEffect, useRef, memo } from "react";
import dynamic from "next/dynamic";
import type { Event } from "@/lib/supabase-types";
import { logger } from "@/lib/logger";

interface EventMapProps {
  event: Event;
  nearbyEvents?: Event[];
}

import type L from "leaflet";

const EventMapInner = memo(function EventMap({ event, nearbyEvents = [] }: EventMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  
  // Check if main event has coordinates, otherwise find first nearby event with coordinates
  const primaryEvent = event.venue_latitude && event.venue_longitude 
    ? event 
    : nearbyEvents.find(e => e.venue_latitude && e.venue_longitude);
  
  const hasCoordinates = !!(primaryEvent?.venue_latitude && primaryEvent?.venue_longitude);
  
  // For dashboard view, aggregate all events with coordinates
  const allEventsWithCoordinates = [
    ...(event.venue_latitude && event.venue_longitude ? [event] : []),
    ...nearbyEvents.filter(e => e.venue_latitude && e.venue_longitude)
  ];
  const uniqueEvents = Array.from(new Map(allEventsWithCoordinates.map(e => [e.id, e])).values());

  useEffect(() => {
    function handleResize() {
      if (mapRef.current) {
        mapRef.current.invalidateSize({ animate: false });
      }
    }
    if (typeof window !== "undefined") {
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !hasCoordinates || !containerRef.current) return;

    let mounted = true;

    const initMap = async () => {
      try {
        const L = (await import("leaflet")).default;
        await import("leaflet/dist/leaflet.css");
        if (!mounted) return;

        // Fix default icons globally
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
          iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
          shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
        });

        if (!mapRef.current) {
          const map = L.map(containerRef.current!).setView([primaryEvent!.venue_latitude!, primaryEvent!.venue_longitude!], 14);
          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
          }).addTo(map);
          mapRef.current = map;
        }

        const map = mapRef.current;

        // Force Leaflet to recalculate container size.
        setTimeout(() => {
          if (mounted && mapRef.current) {
            mapRef.current.invalidateSize({ animate: false });
          }
        }, 100);

        // Clear existing markers
        map.eachLayer((layer: L.Layer) => {
          if ('_icon' in layer) map.removeLayer(layer);
        });

        const blueIcon = L.icon({
          iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
          shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41],
        });

        const group = new L.FeatureGroup([]);

        // Add all events with coordinates
        uniqueEvents.forEach((evt) => {
          const marker = L.marker([evt.venue_latitude!, evt.venue_longitude!], { icon: blueIcon })
            .bindPopup(`
              <div style="padding:8px;min-width:160px">
                <h3 style="font-weight:700;font-size:13px;margin-bottom:4px">${evt.event_name}</h3>
                <p style="font-size:11px;color:#71717a">${evt.venue_name || evt.venue_city || "Venue"}</p>
                ${evt.id !== event.id ? `<a href="/event/${evt.id}" style="font-size:11px;color:#3b82f6">View Event →</a>` : ""}
              </div>
            `);
          marker.addTo(map);
          group.addLayer(marker);
        });

        // Fit bounds to show all markers, or center on primary event
        if (uniqueEvents.length > 1) {
          map.fitBounds(group.getBounds(), { padding: [50, 50] });
        } else if (primaryEvent) {
          map.setView([primaryEvent.venue_latitude!, primaryEvent.venue_longitude!], 14);
        }

      } catch (error) {
        logger.error("[EventMap] Failed to initialize map:", error);
      }
    };

    initMap();

    // Single central cleanup handler
    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [event.venue_latitude, event.venue_longitude, event.event_name, event.venue_name, event.venue_city, event.id, nearbyEvents, hasCoordinates, primaryEvent, uniqueEvents]);

  if (!hasCoordinates) {
    return (
      <div className="bg-[#2b2b2b] rounded-xl p-6 border border-zinc-800/50 text-center h-full flex items-center justify-center">
        <p className="text-zinc-400">📍 No location set for this event</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full rounded-xl z-0"
      style={{ height: "50vh", minHeight: "300px" }}
    />
  );
});

export const EventMap = dynamic(() => Promise.resolve(EventMapInner), { ssr: false });
