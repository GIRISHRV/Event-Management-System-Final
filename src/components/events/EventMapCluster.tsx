"use client";

import { useEffect, useRef, useState, memo } from "react";
import Link from "next/link";
import { MapPin, Calendar, ExternalLink } from "lucide-react";
import type { Event } from "@/lib/supabase-types";
import type { Map } from "leaflet";

interface EventMapClusterProps {
  events: Event[];
  height?: string;
  onEventSelect?: (event: Event) => void;
  isLoading?: boolean;
}

export const EventMapCluster = memo(function EventMapCluster({
  events,
  height = "400px",
  onEventSelect,
  isLoading = false,
}: EventMapClusterProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  if (isLoading) {
    return (
      <div 
        className="bg-zinc-900/50 rounded-xl border border-zinc-800 animate-pulse"
        style={{ height }}
      >
        <div className="h-full w-full bg-zinc-800/50 rounded-xl" />
      </div>
    );
  }

  // Filter events with valid coordinates
  const eventsWithCoords = events.filter(
    (e) => e.venue_latitude && e.venue_longitude
  );

  // Separate effect for map initialization
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const initMap = async () => {
      try {
        const L = (await import("leaflet")).default;
        await import("leaflet/dist/leaflet.css");

        // Import marker cluster plugin
        await import("leaflet.markercluster/dist/MarkerCluster.css");
        await import("leaflet.markercluster/dist/MarkerCluster.Default.css");
        
        // Handle different module formats for leaflet.markercluster
        let MarkerClusterGroup;
        try {
          const module = await import("leaflet.markercluster");
          MarkerClusterGroup = module.MarkerClusterGroup || (module.default as any)?.MarkerClusterGroup || (L as any).MarkerClusterGroup;
        } catch (e) {
          console.warn("Failed to load markercluster module, checking L.MarkerClusterGroup");
          MarkerClusterGroup = (L as any).MarkerClusterGroup;
        }

        if (!MarkerClusterGroup) {
          console.error("MarkerClusterGroup could not be loaded");
          return;
        }

        // Fix for Leaflet default icons
        L.Icon.Default.mergeOptions({
          iconRetinaUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
          iconUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
          shadowUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
        });

        if (!mapRef.current && mapContainer.current) {
          mapRef.current = L.map(mapContainer.current).setView([0, 0], 2);

          // Add dark mode tiles
          L.tileLayer(
            "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
            {
              attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
              maxZoom: 19,
            }
          ).addTo(mapRef.current);

          setIsLoaded(true);
        }
      } catch (error) {
        console.error("Failed to initialize map:", error);
      }
    };

    initMap();

    return () => {
      if (mapRef.current) {
        try {
          mapRef.current.off();
          mapRef.current.remove();
        } catch (e) {
          console.warn("Error cleaning up map:", e);
        }
        mapRef.current = null;
        setIsLoaded(false);
      }
    };
  }, []); // Only run once on mount

  // Effect for updating markers
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;

    const updateMarkers = async () => {
      try {
        const L = (await import("leaflet")).default;
        
        // Handle different module formats for leaflet.markercluster
        let MarkerClusterGroup;
        try {
          const module = await import("leaflet.markercluster");
          MarkerClusterGroup = module.MarkerClusterGroup || (module.default as any)?.MarkerClusterGroup || (L as any).MarkerClusterGroup;
        } catch (e) {
          MarkerClusterGroup = (L as any).MarkerClusterGroup;
        }

        if (!MarkerClusterGroup) return;

        // Clear existing markers
        if (markersRef.current) {
          try {
            mapRef.current?.removeLayer(markersRef.current);
          } catch (e) {
            console.warn("Error removing markers:", e);
          }
          markersRef.current = null;
        }

        if (eventsWithCoords.length === 0) return;

        // Create marker cluster group
        const markers = new MarkerClusterGroup({
          chunkedLoading: true,
          spiderfyOnMaxZoom: true,
          showCoverageOnHover: false,
          zoomToBoundsOnClick: true,
          maxClusterRadius: 50,
          iconCreateFunction: (cluster: any) => {
            const count = cluster.getChildCount();
            let size = "small";
            if (count > 10) size = "medium";
            if (count > 25) size = "large";

            return L.divIcon({
              html: `<div class="cluster-icon cluster-${size}">${count}</div>`,
              className: "marker-cluster",
              iconSize: L.point(40, 40),
            });
          },
        });

        // Custom green icon
        const greenIcon = L.icon({
          iconUrl:
            "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
          shadowUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41],
        });

        // Add markers
        eventsWithCoords.forEach((event) => {
          const marker = L.marker(
            [event.venue_latitude!, event.venue_longitude!],
            { icon: greenIcon }
          );

          marker.bindPopup(`
            <div style="min-width: 200px; padding: 8px;">
              <h3 style="font-weight: 600; font-size: 14px; margin-bottom: 8px; color: #22c55e;">
                ${event.event_name}
              </h3>
              <p style="font-size: 12px; color: #71717a; margin-bottom: 4px;">
                📍 ${event.venue_name || event.venue_city || "Location"}
              </p>
              <p style="font-size: 12px; color: #71717a; margin-bottom: 8px;">
                📅 ${new Date(event.start_date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
                ${event.start_time ? ` at ${event.start_time}` : ""}
              </p>
              <a href="/event/${event.id}" 
                 style="display: inline-block; padding: 6px 12px; background: #22c55e; color: white; border-radius: 6px; font-size: 12px; text-decoration: none;">
                View Event →
              </a>
            </div>
          `);

          marker.on("click", () => {
            setSelectedEvent(event);
            onEventSelect?.(event);
          });

          markers.addLayer(marker);
        });

        mapRef.current?.addLayer(markers);
        markersRef.current = markers;

        // Fit bounds
        if (eventsWithCoords.length > 0) {
          const bounds = L.latLngBounds(
            eventsWithCoords.map((e) => [e.venue_latitude!, e.venue_longitude!])
          );
          mapRef.current?.fitBounds(bounds, { padding: [50, 50] });
        }
      } catch (error) {
        console.error("Error updating markers:", error);
      }
    };

    updateMarkers();
  }, [eventsWithCoords, isLoaded, onEventSelect]);

  if (eventsWithCoords.length === 0) {
    return (
      <div
        className="bg-zinc-900/50 rounded-2xl border border-zinc-800 flex items-center justify-center"
        style={{ height }}
      >
        <div className="text-center text-zinc-500">
          <MapPin size={48} className="mx-auto mb-4 opacity-50" />
          <p>No events with location data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl overflow-hidden border border-zinc-800">
      {/* Add custom cluster styles */}
      <style jsx global>{`
        .marker-cluster {
          background: transparent;
        }
        .cluster-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          font-weight: 600;
          color: white;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
        .cluster-small {
          width: 30px;
          height: 30px;
          background: rgba(34, 197, 94, 0.9);
          font-size: 12px;
        }
        .cluster-medium {
          width: 36px;
          height: 36px;
          background: rgba(251, 146, 60, 0.9);
          font-size: 13px;
        }
        .cluster-large {
          width: 42px;
          height: 42px;
          background: rgba(239, 68, 68, 0.9);
          font-size: 14px;
        }
        .leaflet-popup-content-wrapper {
          background: #18181b;
          border: 1px solid #3f3f46;
          border-radius: 12px;
        }
        .leaflet-popup-tip {
          background: #18181b;
          border: 1px solid #3f3f46;
        }
        .leaflet-popup-content {
          margin: 0;
        }
      `}</style>

      <div ref={mapContainer} style={{ height }} />

      {/* Event count badge */}
      <div className="absolute top-4 left-4 z-1000 bg-zinc-900/90 backdrop-blur-sm px-3 py-2 rounded-lg border border-zinc-700">
        <span className="text-sm text-zinc-300">
          <span className="text-primary font-semibold">
            {eventsWithCoords.length}
          </span>{" "}
          events on map
        </span>
      </div>

      {/* Selected event card */}
      {selectedEvent && (
        <div className="absolute bottom-4 left-4 right-4 z-1000 bg-zinc-900/95 backdrop-blur-sm rounded-xl border border-zinc-700 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white truncate">
                {selectedEvent.event_name}
              </h3>
              <div className="flex items-center gap-3 mt-2 text-sm text-zinc-400">
                <span className="flex items-center gap-1">
                  <Calendar size={14} />
                  {new Date(selectedEvent.start_date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                {selectedEvent.venue_city && (
                  <span className="flex items-center gap-1">
                    <MapPin size={14} />
                    {selectedEvent.venue_city}
                  </span>
                )}
              </div>
            </div>
            <Link
              href={`/event/${selectedEvent.id}`}
              className="shrink-0 flex items-center gap-1 px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg transition"
            >
              View <ExternalLink size={14} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
});
