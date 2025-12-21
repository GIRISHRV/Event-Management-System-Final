"use client";

import { useEffect, useRef, useState, memo } from "react";
import type { Event } from "@/lib/supabase-types";
import type { Map, Layer } from "leaflet";

interface EventMapProps {
  event: Event;
  nearbyEvents?: Event[];
}

export const EventMap = memo(function EventMap({ event, nearbyEvents = [] }: EventMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Check if we have valid coordinates
  const hasCoordinates = event.venue_latitude && event.venue_longitude;

  useEffect(() => {
    if (!hasCoordinates || !mapContainer.current || isLoaded) return;

    // Dynamically import Leaflet only on client-side
    const initMap = async () => {
      try {
        const L = (await import("leaflet")).default;
        await import("leaflet/dist/leaflet.css");

        // Fix for Leaflet default icons in Next.js
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
          iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
          shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
        });

        // Initialize map
        if (!mapRef.current && mapContainer.current) {
          mapRef.current = L.map(mapContainer.current).setView(
            [event.venue_latitude!, event.venue_longitude!],
            13
          );

          // Add OpenStreetMap tiles
          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
          }).addTo(mapRef.current);
        }

        // Clear existing markers
        mapRef.current?.eachLayer((layer: Layer) => {
          if ('_icon' in layer) { // Marker has _icon property
            mapRef.current?.removeLayer(layer);
          }
        });

        // Add main event marker
        const mainIcon = L.icon({
          iconUrl:
            "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
          shadowUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41],
        });

        const mainMarker = L.marker([event.venue_latitude!, event.venue_longitude!], {
          icon: mainIcon,
        })
          .bindPopup(
            `
            <div class="p-2">
              <h3 class="font-bold text-sm">${event.event_name}</h3>
              <p class="text-xs text-gray-600">${event.venue_name || "No venue"}</p>
              <a href="https://www.google.com/maps/search/${event.venue_latitude},${event.venue_longitude}" target="_blank" class="text-xs text-primary hover:underline mt-2 inline-block">Get Directions →</a>
            </div>
          `
          )
          .addTo(mapRef.current);

        // Add nearby events markers
        nearbyEvents.forEach((nearbyEvent) => {
          if (nearbyEvent.venue_latitude && nearbyEvent.venue_longitude) {
            const nearbyIcon = L.icon({
              iconUrl:
                "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
              shadowUrl:
                "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
              iconSize: [25, 41],
              iconAnchor: [12, 41],
              popupAnchor: [1, -34],
              shadowSize: [41, 41],
            });

            L.marker([nearbyEvent.venue_latitude, nearbyEvent.venue_longitude], {
              icon: nearbyIcon,
            })
              .bindPopup(
                `
                <div class="p-2">
                  <h3 class="font-bold text-sm">${nearbyEvent.event_name}</h3>
                  <p class="text-xs text-gray-600">${nearbyEvent.venue_name || "No venue"}</p>
                  <a href="/event/${nearbyEvent.id}" class="text-xs text-primary hover:underline mt-2 inline-block">View Event →</a>
                </div>
              `
              )
              .addTo(mapRef.current);
          }
        });

        // Auto-fit bounds if there are multiple markers
        if (nearbyEvents.length > 0 && mapRef.current) {
          const group = new L.FeatureGroup([mainMarker]);
          nearbyEvents.forEach((nearbyEvent) => {
            if (nearbyEvent.venue_latitude && nearbyEvent.venue_longitude) {
              group.addLayer(
                L.marker([nearbyEvent.venue_latitude, nearbyEvent.venue_longitude])
              );
            }
          });
          mapRef.current.fitBounds(group.getBounds(), { padding: [50, 50] });
        }

        setIsLoaded(true);
      } catch (err) {
        console.error('[EventMap] Error initializing map:', err);
        // Map failed to load - will show fallback UI
      }
    };

    initMap();
  }, [event, nearbyEvents, hasCoordinates, isLoaded]);

  if (!hasCoordinates) {
    return (
      <div className="bg-zinc-900/50 rounded-xl p-8 border border-zinc-800/50 backdrop-blur text-center">
        <p className="text-gray-400">
          📍 Location coordinates not available for this event
        </p>
      </div>
    );
  }

  return (
    <div className="mb-12">
      <h2 className="text-2xl font-bold text-white mb-6">Event Location</h2>
      <div
        ref={mapContainer}
        className="w-full h-96 rounded-xl border border-zinc-800/50 shadow-lg overflow-hidden"
        style={{ zIndex: 1 }}
      />
      <div className="mt-4 flex items-center gap-3 text-sm text-gray-400">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span>This Event</span>
        </div>
        {nearbyEvents.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span>Nearby Events</span>
          </div>
        )}
      </div>
    </div>
  );
});
