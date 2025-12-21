"use client";

import React, { useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { LatLng, Icon } from 'leaflet';
import { Search, MapPin, Navigation, Loader2 } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in react-leaflet
delete (Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface LocationData {
  lat: number;
  lng: number;
  address?: string;
  venue_name?: string;
  venue_city?: string;
  venue_landmark?: string;
  display_name?: string;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  address?: {
    building?: string;
    shop?: string;
    city?: string;
    town?: string;
    village?: string;
    tourism?: string;
    amenity?: string;
  };
}

interface OpenMapLocationPickerProps {
  onLocationSelect: (location: LocationData) => void;
  initialLocation?: { lat: number; lng: number };
  className?: string;
}

// Component to handle map click events
function LocationMarker({ 
  position, 
  onPositionChange 
}: { 
  position: LatLng | null; 
  onPositionChange: (position: LatLng) => void;
}) {
  useMapEvents({
    click: (e) => {
      onPositionChange(e.latlng);
    },
  });

  return position ? <Marker position={position} /> : null;
}

export function OpenMapLocationPicker({ 
  onLocationSelect, 
  initialLocation,
  className = "" 
}: OpenMapLocationPickerProps) {
  const [position, setPosition] = useState<LatLng | null>(
    initialLocation ? new LatLng(initialLocation.lat, initialLocation.lng) : null
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [mapCenter, setMapCenter] = useState<LatLng>(
    initialLocation ? new LatLng(initialLocation.lat, initialLocation.lng) : new LatLng(28.6139, 77.2090) // Default to Delhi
  );

  // Reverse geocode to get address from coordinates
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'EventManagementSystem/1.0 (https://github.com)'
          }
        }
      );
      const data = await response.json();
      
      if (data && data.display_name) {
        const locationData: LocationData = {
          lat,
          lng,
          address: data.display_name,
          venue_name: data.name || data.address?.building || data.address?.shop || '',
          venue_city: data.address?.city || data.address?.town || data.address?.village || '',
          venue_landmark: data.address?.tourism || data.address?.amenity || '',
          display_name: data.display_name
        };
        
        setSelectedLocation(locationData);
        onLocationSelect(locationData);
      }
    } catch {
      // Reverse geocoding failed - location still works, just no address
    }
  }, [onLocationSelect]);

  // Handle position change
  const handlePositionChange = useCallback((newPosition: LatLng) => {
    setPosition(newPosition);
    reverseGeocode(newPosition.lat, newPosition.lng);
  }, [reverseGeocode]);

  // Search for locations
  const searchLocation = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'EventManagementSystem/1.0 (https://github.com)'
          }
        }
      );
      const data = await response.json();
      setSearchResults(data);
    } catch {
      // Search failed - show no results
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  // Handle search result selection
  const handleSearchResultSelect = useCallback((result: NominatimResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    const newPosition = new LatLng(lat, lng);
    
    setPosition(newPosition);
    setMapCenter(newPosition);
    setSearchResults([]);
    setSearchQuery(result.display_name);
    
    const locationData: LocationData = {
      lat,
      lng,
      address: result.display_name,
      venue_name: result.name || result.address?.building || result.address?.shop || '',
      venue_city: result.address?.city || result.address?.town || result.address?.village || '',
      venue_landmark: result.address?.tourism || result.address?.amenity || '',
      display_name: result.display_name
    };
    
    setSelectedLocation(locationData);
    onLocationSelect(locationData);
  }, [onLocationSelect]);

  // Get user's current location
  const getCurrentLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const newPosition = new LatLng(lat, lng);
          setPosition(newPosition);
          setMapCenter(newPosition);
          reverseGeocode(lat, lng);
        },
        () => {
          // Geolocation failed - user can manually search
        }
      );
    }
  }, [reverseGeocode]);

  // Handle search form submission
  const handleSearchSubmit = (e?: React.FormEvent | React.KeyboardEvent) => {
    e?.preventDefault();
    searchLocation();
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search Bar */}
      <div className="space-y-2 relative">
        <div className="flex gap-2">
          <div className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for a location..."
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearchSubmit(e);
                  }
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/50 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>
            <button
              type="button"
              onClick={handleSearchSubmit}
              disabled={isSearching}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 text-white rounded-xl transition-colors flex items-center gap-2 font-medium shadow-lg shadow-emerald-500/20"
            >
              {isSearching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
              <span className="hidden sm:inline">{isSearching ? 'Searching...' : 'Search'}</span>
            </button>
          </div>
          <button
            type="button"
            onClick={getCurrentLocation}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors flex items-center gap-2 border border-zinc-700"
            title="Use current location"
          >
            <Navigation size={18} />
          </button>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto">
            {searchResults.map((result, index) => (
              <button
                key={index}
                onClick={() => handleSearchResultSelect(result)}
                className="w-full text-left px-4 py-3 hover:bg-zinc-800 transition-colors border-b border-zinc-800 last:border-b-0 flex items-start gap-3"
              >
                <MapPin size={16} className="text-emerald-400 mt-1 shrink-0" />
                <div>
                  <div className="text-white font-medium text-sm">{result.name || 'Unnamed Location'}</div>
                  <div className="text-zinc-500 text-xs mt-0.5">{result.display_name}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map Container */}
      <div className="relative rounded-xl overflow-hidden border border-zinc-800 shadow-inner bg-zinc-900">
        <MapContainer
          center={mapCenter}
          zoom={13}
          style={{ height: '400px', width: '100%' }}
          className="z-10"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationMarker 
            position={position} 
            onPositionChange={handlePositionChange}
          />
        </MapContainer>
        
        {/* Map Instructions */}
        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md text-white text-xs px-3 py-2 rounded-lg z-20 border border-white/10 shadow-lg">
          Click on the map to select a location
        </div>
      </div>

      {/* Selected Location Info */}
      {selectedLocation && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
            <MapPin size={16} />
            Selected Location Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {selectedLocation.venue_name && (
              <div>
                <span className="text-zinc-500 block text-xs mb-1">Venue Name</span>
                <span className="text-white font-medium">{selectedLocation.venue_name}</span>
              </div>
            )}
            <div className="md:col-span-2">
              <span className="text-zinc-500 block text-xs mb-1">Full Address</span>
              <span className="text-white">{selectedLocation.address}</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-xs mb-1">Coordinates</span>
              <span className="text-zinc-300 font-mono text-xs">
                {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
              </span>
            </div>
            {selectedLocation.venue_city && (
              <div>
                <span className="text-zinc-500 block text-xs mb-1">City</span>
                <span className="text-white">{selectedLocation.venue_city}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}