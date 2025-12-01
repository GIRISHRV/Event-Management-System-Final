import React from 'react';
import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";
import { EventFormData } from "@/types/events";
import { VENUE_TYPES } from "@/lib/constants";

const OpenMapLocationPicker = dynamic(
  () => import('../OpenMapLocationPicker').then(mod => ({ default: mod.OpenMapLocationPicker })),
  { 
    ssr: false,
    loading: () => (
      <div className="h-64 bg-zinc-800 rounded-lg animate-pulse flex items-center justify-center">
        <span className="text-zinc-400">Loading map...</span>
      </div>
    )
  }
);

interface VenueTabProps {
  formData: EventFormData;
  updateFormData: (updates: Partial<EventFormData>) => void;
  onLocationSelect: (location: { lat: number; lng: number }) => void;
}

export const VenueTab: React.FC<VenueTabProps> = ({
  formData,
  updateFormData,
  onLocationSelect,
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
        <p className="text-sm text-yellow-400 flex items-center gap-2">
          <MapPin size={16} />
          <span><strong>Required:</strong> Please select a location on the map below</span>
        </p>
      </div>
      
      <OpenMapLocationPicker
        onLocationSelect={onLocationSelect}
        initialLocation={formData.latitude && formData.longitude ? { lat: formData.latitude, lng: formData.longitude } : undefined}
      />

      {formData.latitude && formData.longitude && (
        <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3">
          <p className="text-sm text-green-400">
            ✓ Location selected: {formData.latitude?.toFixed(6)}, {formData.longitude?.toFixed(6)}
          </p>
        </div>
      )}

      <div>
        <label htmlFor="venueType" className="block text-sm font-medium text-gray-300 mb-2">
          Venue Type
        </label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <select
            id="venueType"
            value={formData.venueType}
                onChange={(e) => updateFormData({ venueType: e.target.value as 'indoor' | 'outdoor' | 'hybrid' })}
            className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white"
          >
            <option value={VENUE_TYPES.INDOOR}>Indoor</option>
            <option value={VENUE_TYPES.OUTDOOR}>Outdoor</option>
            <option value={VENUE_TYPES.HYBRID}>Hybrid</option>
          </select>
        </div>
      </div>
    </div>
  );
};


