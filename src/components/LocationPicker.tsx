"use client";

import { useState } from "react";
import { Wrapper } from "@googlemaps/react-wrapper";

interface MapComponentProps {
  center: { lat: number; lng: number };
  zoom: number;
  onLocationSelect?: (lat: number, lng: number, address?: string) => void;
  selectedLocation?: { lat: number; lng: number };
}

function MapComponent({ center, zoom, onLocationSelect, selectedLocation }: MapComponentProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [marker, setMarker] = useState<google.maps.Marker | null>(null);

  const ref = (node: HTMLDivElement | null) => {
    if (node && !map) {
      const newMap = new window.google.maps.Map(node, {
        center,
        zoom,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });

      setMap(newMap);

      // Create marker for selected location
      if (selectedLocation) {
        const newMarker = new window.google.maps.Marker({
          position: selectedLocation,
          map: newMap,
          draggable: true,
          title: "Event Location",
        });

        newMarker.addListener("dragend", () => {
          const position = newMarker.getPosition();
          if (position && onLocationSelect) {
            const lat = position.lat();
            const lng = position.lng();
            onLocationSelect(lat, lng);
          }
        });

        setMarker(newMarker);
      }

      // Add click listener to place marker
      newMap.addListener("click", (e: google.maps.MapMouseEvent) => {
        const lat = e.latLng?.lat();
        const lng = e.latLng?.lng();

        if (lat && lng && onLocationSelect) {
          // Remove existing marker
          if (marker) {
            marker.setMap(null);
          }

          // Create new marker
          const newMarker = new window.google.maps.Marker({
            position: { lat, lng },
            map: newMap,
            draggable: true,
            title: "Event Location",
          });

          newMarker.addListener("dragend", () => {
            const position = newMarker.getPosition();
            if (position) {
              const newLat = position.lat();
              const newLng = position.lng();
              onLocationSelect(newLat, newLng);
            }
          });

          setMarker(newMarker);
          onLocationSelect(lat, lng);

          // Reverse geocode to get address
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ location: { lat, lng } }, (results, status) => {
            if (status === "OK" && results?.[0]) {
              onLocationSelect(lat, lng, results[0].formatted_address);
            }
          });
        }
      });
    }
  };

  return <div ref={ref} className="w-full h-64 rounded-lg" />;
}

interface LocationPickerProps {
  onLocationSelect: (location: {
    lat: number;
    lng: number;
    address?: string;
    venue_name?: string;
    venue_city?: string;
    venue_landmark?: string;
  }) => void;
  initialLocation?: { lat: number; lng: number };
  apiKey: string;
}

export function LocationPicker({ onLocationSelect, initialLocation, apiKey }: LocationPickerProps) {
  const [selectedLocation, setSelectedLocation] = useState(initialLocation);
  const [address, setAddress] = useState("");
  const [venueName, setVenueName] = useState("");
  const [venueCity, setVenueCity] = useState("");
  const [venueLandmark, setVenueLandmark] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const defaultCenter = initialLocation || { lat: 40.7128, lng: -74.0060 }; // Default to NYC

  const handleLocationSelect = (lat: number, lng: number, geocodedAddress?: string) => {
    const location = { lat, lng };
    setSelectedLocation(location);
    
    if (geocodedAddress) {
      setAddress(geocodedAddress);
      // Try to extract city from address
      const addressParts = geocodedAddress.split(", ");
      if (addressParts.length > 1) {
        setVenueCity(addressParts[addressParts.length - 3] || "");
      }
    }

    onLocationSelect({
      lat,
      lng,
      address: geocodedAddress || address,
      venue_name: venueName,
      venue_city: venueCity,
      venue_landmark: venueLandmark,
    });
  };

  const searchLocation = async () => {
    if (!searchQuery.trim()) return;

    try {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address: searchQuery }, (results, status) => {
        if (status === "OK" && results?.[0]) {
          const location = results[0].geometry.location;
          const lat = location.lat();
          const lng = location.lng();
          handleLocationSelect(lat, lng, results[0].formatted_address);
        }
      });
    } catch (error) {
      console.error("Error searching location:", error);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    switch (field) {
      case "venueName":
        setVenueName(value);
        break;
      case "venueCity":
        setVenueCity(value);
        break;
      case "venueLandmark":
        setVenueLandmark(value);
        break;
      case "address":
        setAddress(value);
        break;
    }

    onLocationSelect({
      lat: selectedLocation?.lat || 0,
      lng: selectedLocation?.lng || 0,
      address,
      venue_name: field === "venueName" ? value : venueName,
      venue_city: field === "venueCity" ? value : venueCity,
      venue_landmark: field === "venueLandmark" ? value : venueLandmark,
    });
  };

  const render = (status: any) => {
    if (status === "LOADING") return <div className="h-64 bg-zinc-800 rounded-lg animate-pulse flex items-center justify-center text-white">Loading Maps...</div>;
    if (status === "FAILURE") return <div className="h-64 bg-zinc-800 rounded-lg flex items-center justify-center text-red-400">Failed to load maps</div>;
    return (
      <MapComponent
        center={defaultCenter}
        zoom={13}
        onLocationSelect={handleLocationSelect}
        selectedLocation={selectedLocation}
      />
    );
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search for a location..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && searchLocation()}
          className="flex-1 px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
        />
        <button
          type="button"
          onClick={searchLocation}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
        >
          Search
        </button>
      </div>

      {/* Map */}
      <Wrapper apiKey={apiKey} render={render} />

      {/* Location Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Venue Name
          </label>
          <input
            type="text"
            value={venueName}
            onChange={(e) => handleInputChange("venueName", e.target.value)}
            placeholder="Enter venue name"
            className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            City
          </label>
          <input
            type="text"
            value={venueCity}
            onChange={(e) => handleInputChange("venueCity", e.target.value)}
            placeholder="Enter city"
            className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Full Address
          </label>
          <textarea
            value={address}
            onChange={(e) => handleInputChange("address", e.target.value)}
            placeholder="Enter full address"
            rows={2}
            className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Nearby Landmark (Optional)
          </label>
          <input
            type="text"
            value={venueLandmark}
            onChange={(e) => handleInputChange("venueLandmark", e.target.value)}
            placeholder="e.g., Near Central Park, Next to Shopping Mall"
            className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
          />
        </div>
      </div>

      {selectedLocation && (
        <div className="p-3 bg-zinc-800 rounded-lg text-sm text-gray-300">
          <strong>Selected Location:</strong> {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
        </div>
      )}
    </div>
  );
}