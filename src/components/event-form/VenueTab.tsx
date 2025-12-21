import React from 'react';
import dynamic from "next/dynamic";
import { MapPin, Building, Navigation, Map as MapIcon } from "lucide-react";
import { UseFormRegister, FieldErrors, UseFormWatch } from 'react-hook-form';
import { EventFormSchema } from '@/lib/schemas';
import { VENUE_TYPES } from "@/lib/constants";

const OpenMapLocationPicker = dynamic(
  () => import('./OpenMapLocationPicker').then(mod => ({ default: mod.OpenMapLocationPicker })),
  { 
    ssr: false,
    loading: () => (
      <div className="h-80 bg-zinc-900/50 rounded-xl animate-pulse flex items-center justify-center border border-zinc-800">
        <span className="text-zinc-500 flex items-center gap-2">
          <MapIcon size={20} />
          Loading map interface...
        </span>
      </div>
    )
  }
);

interface VenueTabProps {
  register: UseFormRegister<EventFormSchema>;
  errors: FieldErrors<EventFormSchema>;
  watch: UseFormWatch<EventFormSchema>;
  onLocationSelect: (location: { 
    lat: number; 
    lng: number;
    address?: string;
    venue_name?: string;
    venue_city?: string;
    venue_landmark?: string;
  }) => void;
}

export const VenueTab: React.FC<VenueTabProps> = ({
  register,
  errors,
  watch,
  onLocationSelect,
}) => {
  const latitude = watch('latitude');
  const longitude = watch('longitude');

  const inputClasses = `
    w-full px-3 py-2.5 bg-zinc-900/50 border rounded-xl text-white placeholder-zinc-500 
    focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 
    transition-all duration-200
  `;
  
  const labelClasses = "block text-sm font-medium text-zinc-400 mb-2 ml-1";

  return (
    <div className="space-y-6">
      {/* Map Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className={labelClasses}>
            Event Location <span className="text-red-400">*</span>
          </label>
          {latitude && longitude && (
            <span className="text-xs text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
              <MapPin size={12} />
              Location Selected
            </span>
          )}
        </div>
        
        <div className="rounded-xl overflow-hidden border border-zinc-800 shadow-lg shadow-black/20">
          <OpenMapLocationPicker
            onLocationSelect={onLocationSelect}
            initialLocation={latitude && longitude ? { lat: latitude, lng: longitude } : undefined}
          />
        </div>
        
        {errors.latitude && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm">
            <MapPin size={16} />
            Please select a location on the map above
          </div>
        )}
      </div>

      {/* Venue Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="md:col-span-2">
          <label className={labelClasses}>Venue Name</label>
          <div className="relative">
            <Building className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 w-5 h-5" />
            <input
              type="text"
              {...register('venueName')}
              className={`${inputClasses} pl-12 border-zinc-800`}
              placeholder="e.g. Grand Convention Center"
            />
          </div>
        </div>

        <div className="md:col-span-2">
          <label className={labelClasses}>Full Address</label>
          <div className="relative">
            <MapPin className="absolute left-4 top-3 text-zinc-500 w-5 h-5" />
            <textarea
              {...register('venueAddress')}
              rows={2}
              className={`${inputClasses} pl-12 border-zinc-800 resize-none`}
              placeholder="Street address, building number..."
            />
          </div>
        </div>

        <div>
          <label className={labelClasses}>City</label>
          <input
            type="text"
            {...register('venueCity')}
            className={`${inputClasses} border-zinc-800`}
            placeholder="City name"
          />
        </div>

        <div>
          <label className={labelClasses}>Landmark</label>
          <div className="relative">
            <Navigation className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 w-5 h-5" />
            <input
              type="text"
              {...register('venueLandmark')}
              className={`${inputClasses} pl-12 border-zinc-800`}
              placeholder="Near..."
            />
          </div>
        </div>

        <div className="md:col-span-2">
          <label className={labelClasses}>Venue Type</label>
          <div className="grid grid-cols-3 gap-4">
            {[
              { value: VENUE_TYPES.INDOOR, label: 'Indoor', icon: Building },
              { value: VENUE_TYPES.OUTDOOR, label: 'Outdoor', icon: MapIcon },
              { value: VENUE_TYPES.HYBRID, label: 'Hybrid', icon: Navigation },
            ].map((type) => (
              <label
                key={type.value}
                className={`
                  relative flex flex-col items-center justify-center gap-2 p-4 rounded-xl border cursor-pointer transition-all
                  ${watch('venueType') === type.value 
                    ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' 
                    : 'bg-zinc-900/30 border-zinc-800 text-zinc-400 hover:bg-zinc-900/50 hover:border-zinc-700'}
                `}
              >
                <input
                  type="radio"
                  value={type.value}
                  {...register('venueType')}
                  className="absolute opacity-0 w-full h-full cursor-pointer"
                />
                <type.icon size={24} />
                <span className="text-sm font-medium">{type.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};


