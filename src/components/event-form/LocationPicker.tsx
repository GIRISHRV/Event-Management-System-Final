"use client";

import React, { useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { LatLng, Icon } from 'leaflet';
import { Search, MapPin, Navigation, Loader2 } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { api } from '@/lib/api-client';
import { Modal } from '@/components/ui/Modal';
// import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/button';

// Fix for default markers in react-leaflet
if (typeof window !== 'undefined') {
  delete (Icon.Default.prototype as unknown as { _getIconUrl: unknown })._getIconUrl;
  Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
}

interface LocationData {
  lat: number;
  lng: number;
}

interface GeocodingResult {
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
}

interface LocationPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (location: LocationData) => void;
  initialLocation?: LocationData | null;
}

function MapEvents({ onPositionChange }: { onPositionChange: (latlng: LatLng) => void }) {
  useMapEvents({
    click: (e) => {
      onPositionChange(e.latlng);
    },
  });
  return null;
}

export function LocationPicker({
  isOpen,
  onClose,
  onConfirm,
  initialLocation
}: LocationPickerProps) {
  const [position, setPosition] = useState<LatLng | null>(
    initialLocation ? new LatLng(initialLocation.lat, initialLocation.lng) : null
  );
  const [mapCenter, setMapCenter] = useState<LatLng>(
    initialLocation ? new LatLng(initialLocation.lat, initialLocation.lng) : new LatLng(12.9716, 77.5946) // Default Bangalore
  );
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);

  const handlePositionChange = useCallback((newPosition: LatLng) => {
    setPosition(newPosition);
  }, []);

  const searchLocation = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const data = await api.get<GeocodingResult[]>(`/api/geocoding`, { params: { q: searchQuery } });
      setSearchResults(data);
    } catch {
      // ignore
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  const handleSearchResultSelect = useCallback((result: GeocodingResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    const newPosition = new LatLng(lat, lng);

    setPosition(newPosition);
    setMapCenter(newPosition);
    setSearchResults([]);
    setSearchQuery(result.display_name);
  }, []);

  const getCurrentLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newPosition = new LatLng(pos.coords.latitude, pos.coords.longitude);
          setPosition(newPosition);
          setMapCenter(newPosition);
        },
        () => {}
      );
    }
  }, []);

  const handleConfirm = () => {
    if (position) {
      onConfirm({ lat: position.lat, lng: position.lng });
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pick Event Location"
      type="info"
    >
      <div className="space-y-4">
        <p className="text-[var(--color-text-secondary)] text-sm mb-4">
          Choose the exact location for your event to help guests find you easily.
        </p>
        {/* Search Bar */}
        <div className="flex gap-2 relative">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] w-4 h-4 z-10" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search city, venue..."
              onKeyDown={(e) => e.key === 'Enter' && searchLocation()}
              className="w-full pl-9 pr-3 h-10 bg-[var(--color-input)] border border-[var(--color-input-border)] rounded-[var(--radius-md)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-input-focus)] focus:ring-1 focus:ring-[var(--color-input-focus)]"
            />
          </div>
          <Button type="button" variant="primary" onClick={searchLocation} disabled={isSearching}>
            {isSearching ? <Loader2 size={16} className="animate-spin" /> : "Search"}
          </Button>
          <Button type="button" variant="secondary" onClick={getCurrentLocation} title="Use my location">
            <Navigation size={16} />
          </Button>

          {/* Search Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-lg z-50 max-h-60 overflow-y-auto">
              {searchResults.map((result, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSearchResultSelect(result)}
                  className="w-full text-left px-4 py-2 hover:bg-[var(--color-surface-hover)] border-b border-[var(--color-border)] last:border-0 flex items-start gap-3"
                >
                  <MapPin size={16} className="text-[var(--color-brand)] mt-1 shrink-0" />
                  <div>
                    <div className="text-[var(--color-text-primary)] font-medium text-sm">{result.name || 'Location'}</div>
                    <div className="text-[var(--color-text-secondary)] text-xs mt-0.5">{result.display_name}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Map Container */}
        <div className="relative h-[300px] w-full rounded-[var(--radius-lg)] overflow-hidden border border-[var(--color-border)] z-0">
          {typeof window !== 'undefined' && (
            <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {position && <Marker position={position} />}
              <MapEvents onPositionChange={handlePositionChange} />
            </MapContainer>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end pt-4 border-t border-[var(--color-border)]">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleConfirm} disabled={!position}>Confirm Location</Button>
        </div>
      </div>
    </Modal>
  );
}
