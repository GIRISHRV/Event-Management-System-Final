"use client";

import React, { useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { LatLng, Icon } from 'leaflet';
import { Search, MapPin, Navigation } from 'lucide-react';
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
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
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
    } catch (error) {
      console.error('Search failed:', error);
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
        (error) => {
          console.error('Error getting current location:', error);
        }
      );
    }
  }, [reverseGeocode]);

  // Handle search form submission
  const handleSearchSubmit = (e?: any) => {
    e.preventDefault();
    searchLocation();
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search Bar */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
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
                className="w-full pl-10 pr-4 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
              />
            </div>
            <button
              type="button"
              onClick={handleSearchSubmit}
              disabled={isSearching}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <Search size={16} />
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>
          <button
            type="button"
            onClick={getCurrentLocation}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
            title="Use current location"
          >
            <Navigation size={16} />
          </button>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="bg-zinc-800 border border-zinc-700 rounded-lg max-h-60 overflow-y-auto">
            {searchResults.map((result, index) => (
              <button
                key={index}
                onClick={() => handleSearchResultSelect(result)}
                className="w-full text-left px-4 py-3 hover:bg-zinc-700 transition-colors border-b border-zinc-700 last:border-b-0"
              >
                <div className="flex items-start gap-3">
                  <MapPin size={16} className="text-green-400 mt-1 shrink-0" />
                  <div>
                    <div className="text-white font-medium">{result.name || 'Unnamed Location'}</div>
                    <div className="text-gray-400 text-sm">{result.display_name}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map Container */}
      <div className="relative rounded-lg overflow-hidden border border-zinc-600">
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
        <div className="absolute top-4 left-4 bg-black/70 text-white text-sm px-3 py-2 rounded-lg z-20">
          Click on the map to select a location
        </div>
      </div>

      {/* Selected Location Info */}
      {selectedLocation && (
        <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
          <h3 className="text-lg font-medium text-white mb-2 flex items-center gap-2">
            <MapPin size={20} className="text-green-400" />
            Selected Location
          </h3>
          <div className="space-y-2 text-sm">
            {selectedLocation.venue_name && (
              <div>
                <span className="text-gray-400">Venue:</span>
                <span className="text-white ml-2">{selectedLocation.venue_name}</span>
              </div>
            )}
            <div>
              <span className="text-gray-400">Address:</span>
              <span className="text-white ml-2">{selectedLocation.address}</span>
            </div>
            <div>
              <span className="text-gray-400">Coordinates:</span>
              <span className="text-white ml-2">
                {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
              </span>
            </div>
            {selectedLocation.venue_city && (
              <div>
                <span className="text-gray-400">City:</span>
                <span className="text-white ml-2">{selectedLocation.venue_city}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}