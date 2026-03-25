import React from "react";
import { type UseFormReturn } from "react-hook-form";
import { MapPin } from "lucide-react";
import { type EventFormData } from "@/schemas/event.schema";
import { VENUE_TYPES } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface VenueTabProps {
  form: UseFormReturn<EventFormData>;
  onOpenMap: () => void;
}

export function VenueTab({ form, onOpenMap }: VenueTabProps) {
  const { register, watch, formState: { errors } } = form;

  const lat = watch("venueLatitude");
  const lng = watch("venueLongitude");
  const hasCoordinates = lat !== null && lng !== null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Input
          label="Venue Name"
          placeholder="e.g. Grand Convention Center"
          {...register("venueName")}
          error={errors.venueName?.message as string}
        />

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            Venue Type
          </label>
          <select
            {...register("venueType")}
            className="w-full h-9 px-3 rounded-[var(--radius-md)] bg-[var(--color-input)] border border-[var(--color-input-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-input-focus)] focus:ring-1 focus:ring-[var(--color-input-focus)] appearance-none cursor-pointer"
          >
            <option value={VENUE_TYPES.INDOOR}>Indoor</option>
            <option value={VENUE_TYPES.OUTDOOR}>Outdoor</option>
            <option value={VENUE_TYPES.HYBRID}>Hybrid</option>
          </select>
        </div>
      </div>

      <Input
        label="Street Address"
        placeholder="Full street address..."
        {...register("venueAddress")}
        error={errors.venueAddress?.message as string}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Input
          label="City"
          placeholder="e.g. Bangalore"
          {...register("venueCity")}
          error={errors.venueCity?.message as string}
        />
        <Input
          label="Landmark"
          placeholder="e.g. Near Metro Station"
          {...register("venueLandmark")}
          error={errors.venueLandmark?.message as string}
        />
      </div>

      {/* Map Picker Trigger */}
      <div className="pt-4 border-t border-[var(--color-border)]">
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-3">
          Event Location
        </label>
        
        <div className="flex items-center justify-between p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)]">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${hasCoordinates ? 'bg-[var(--color-success-muted)] text-[var(--color-success)]' : 'bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)]'}`}>
              <MapPin size={20} />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                {hasCoordinates ? "Location Set" : "Location Required"}
              </p>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5 font-mono">
                {hasCoordinates 
                  ? `${lat.toFixed(4)}°, ${lng.toFixed(4)}°` 
                  : "Click to set your event location"}
              </p>
            </div>
          </div>
          
          <Button
            type="button"
            variant={hasCoordinates ? "secondary" : "primary"}
            onClick={onOpenMap}
          >
            {hasCoordinates ? "Change Location" : "Set Location"}
          </Button>
        </div>
        {errors.venueLatitude && (
          <p className="mt-2 text-xs text-[var(--color-danger)]">{errors.venueLatitude.message}</p>
        )}
      </div>

      <Input
        label="Google Maps URL"
        type="url"
        placeholder="https://maps.google.com/..."
        {...register("googleMapsUrl")}
        error={errors.googleMapsUrl?.message as string}
      />
    </div>
  );
}
