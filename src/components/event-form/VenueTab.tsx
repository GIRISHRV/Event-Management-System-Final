import React from 'react';
import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";
import { UseFormRegister, FieldErrors, UseFormWatch } from 'react-hook-form';
import { EventFormSchema } from '@/lib/schemas';
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
  register: UseFormRegister<EventFormSchema>;
  errors: FieldErrors<EventFormSchema>;
  watch: UseFormWatch<EventFormSchema>;
  onLocationSelect: (location: { lat: number; lng: number }) => void;
}

export const VenueTab: React.FC<VenueTabProps> = ({
  register,
  errors,
  watch,
  onLocationSelect,
}) => {
  const latitude = watch('latitude');
  const longitude = watch('longitude');

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
        initialLocation={latitude && longitude ? { lat: latitude, lng: longitude } : undefined}
      />
      {errors.latitude && <p className="text-red-500 text-xs mt-1">{errors.latitude.message}</p>}

      {latitude && longitude && (
        <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3">
          <p className="text-sm text-green-400">
            ✓ Location selected: {latitude?.toFixed(6)}, {longitude?.toFixed(6)}
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
            {...register('venueType')}
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


