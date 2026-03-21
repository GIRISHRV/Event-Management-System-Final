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
  const hasCoordinates = !!(event.venue_latitude && event.venue_longitude);

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
          const map = L.map(containerRef.current!).setView([event.venue_latitude!, event.venue_longitude!], 14);
          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
          }).addTo(map);
          mapRef.current = map;
        }

        const map = mapRef.current;

        // Force Leaflet to recalculate container size.
        // Use mapRef.current (not the local `map` var) so the callback
        // reads the live ref at execution time, not a stale closure capture.
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

        const mainMarker = L.marker([event.venue_latitude!, event.venue_longitude!], { icon: blueIcon })
          .bindPopup(`
            <div style="padding:8px;min-width:160px">
              <h3 style="font-weight:700;font-size:13px;margin-bottom:4px">${event.event_name}</h3>
              <p style="font-size:11px;color:#71717a">${event.venue_name || event.venue_city || "Venue"}</p>
            </div>
          `);

        mainMarker.addTo(map);

        const group = new L.FeatureGroup([mainMarker]);

        nearbyEvents.forEach((nearbyEvent) => {
          if (nearbyEvent.venue_latitude && nearbyEvent.venue_longitude) {
            const marker = L.marker([nearbyEvent.venue_latitude, nearbyEvent.venue_longitude], { icon: blueIcon })
              .bindPopup(`
                <div style="padding:8px;min-width:160px">
                  <h3 style="font-weight:700;font-size:13px;margin-bottom:4px">${nearbyEvent.event_name}</h3>
                  <a href="/event/${nearbyEvent.id}" style="font-size:11px;color:#3b82f6">View Event →</a>
                </div>
              `);
            marker.addTo(map);
            group.addLayer(marker);
          }
        });

        if (nearbyEvents.length > 0) {
          map.fitBounds(group.getBounds(), { padding: [50, 50] });
        } else {
          map.setView([event.venue_latitude!, event.venue_longitude!], 14);
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
  }, [event.venue_latitude, event.venue_longitude, event.event_name, event.venue_name, event.venue_city, nearbyEvents, hasCoordinates]);

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
