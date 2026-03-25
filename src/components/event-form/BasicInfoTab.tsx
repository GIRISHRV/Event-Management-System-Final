import React, { useRef, useState } from "react";
import Image from "next/image";
import { Upload, Globe, Activity, Users, IndianRupee, Loader2 } from "lucide-react";
import { type UseFormReturn } from "react-hook-form";
import { type EventFormData } from "@/schemas/event.schema";
import { VISIBILITY_TYPES, EVENT_STATUS } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { storageService } from "@/services/supabase/storage";
import { useToast } from "@/hooks/useToast";
import { getErrorMessage } from "@/lib/errors";

interface BasicInfoTabProps {
  form: UseFormReturn<EventFormData>;
  eventId?: string;
}

export function BasicInfoTab({ form, eventId }: BasicInfoTabProps) {
  const { register, watch, setValue, formState: { errors } } = form;
  const eventBannerUrl = watch("eventBannerUrl");
  const { error: toastError, success: toastSuccess } = useToast();

  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const url = await storageService.uploadFile('events', file, {
        folder: eventId || 'new-event/banners'
      });
      setValue('eventBannerUrl', url, { shouldValidate: true, shouldDirty: true });
      toastSuccess("Banner uploaded");
    } catch (error: unknown) {
      toastError(getErrorMessage(error, "Failed to upload banner"));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <Input
        label="Event Name"
        placeholder="e.g. Tech Conference 2026"
        {...register("eventName")}
        error={errors.eventName?.message as string}
      />

      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
          Event Banner
        </label>
        <div className="space-y-4">
          {eventBannerUrl ? (
            <div className="relative w-full h-48 group rounded-[var(--radius-lg)] overflow-hidden border border-[var(--color-border)]">
              <Image
                src={eventBannerUrl}
                alt="Event banner"
                fill
                className="object-cover"
                unoptimized
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-[var(--radius-md)] text-white hover:bg-white/20 transition-colors text-sm font-medium"
                >
                  Change Image
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-32 border-2 border-dashed border-[var(--color-border)] rounded-[var(--radius-lg)] flex flex-col items-center justify-center cursor-pointer hover:border-[var(--color-brand)] hover:bg-[var(--color-surface)] transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <Loader2 className="w-8 h-8 text-[var(--color-brand)] animate-spin mb-2" />
              ) : (
                <Upload className="w-8 h-8 text-[var(--color-text-tertiary)] group-hover:text-[var(--color-brand)] mb-2 transition-colors" />
              )}
              <span className="text-sm text-[var(--color-text-tertiary)] group-hover:text-[var(--color-text-secondary)]">
                {isUploading ? "Uploading..." : "Click to upload banner"}
              </span>
            </button>
          )}

          <div className="flex gap-3">
            <div className="relative flex-1">
              <Input
                type="url"
                placeholder="Or paste image URL..."
                {...register("eventBannerUrl")}
                error={errors.eventBannerUrl?.message as string}
              />
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              className="hidden"
            />
          </div>
        </div>
      </div>

      <Textarea
        label="Description"
        rows={5}
        placeholder="Describe what makes your event special..."
        {...register("eventDescription")}
        error={errors.eventDescription?.message as string}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-4 p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)]">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Start Schedule
          </h3>
          <Input
            label="Date"
            type="date"
            {...register("startDate")}
            error={errors.startDate?.message as string}
          />
          <Input
            label="Time"
            type="time"
            {...register("startTime")}
            error={errors.startTime?.message as string}
          />
        </div>

        <div className="space-y-4 p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)]">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            End Schedule
          </h3>
          <Input
            label="Date"
            type="date"
            {...register("endDate")}
            error={errors.endDate?.message as string}
          />
          <Input
            label="Time"
            type="time"
            {...register("endTime")}
            error={errors.endTime?.message as string}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Input
          label="Organizer Name"
          placeholder="Who is hosting?"
          {...register("organizerName")}
          error={errors.organizerName?.message as string}
        />
        <Input
          label="Organizer Email"
          type="email"
          placeholder="Contact email"
          {...register("organizerEmail")}
          error={errors.organizerEmail?.message as string}
        />
        <Input
          label="Organizer Contact"
          placeholder="Phone or alternative contact"
          {...register("organizerContact")}
          error={errors.organizerContact?.message as string}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            Visibility
          </label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] w-4 h-4 pointer-events-none" />
            <select
              {...register("visibilityType")}
              className="w-full h-9 pl-9 pr-3 rounded-[var(--radius-md)] bg-[var(--color-input)] border border-[var(--color-input-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-input-focus)] focus:ring-1 focus:ring-[var(--color-input-focus)] appearance-none cursor-pointer"
            >
              <option value={VISIBILITY_TYPES.PUBLIC}>Public</option>
              <option value={VISIBILITY_TYPES.PRIVATE}>Private</option>
              <option value={VISIBILITY_TYPES.WHITELIST}>Invite Only</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            Event Status
          </label>
          <div className="relative">
            <Activity className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] w-4 h-4 pointer-events-none" />
            <select
              {...register("eventStatus")}
              className="w-full h-9 pl-9 pr-3 rounded-[var(--radius-md)] bg-[var(--color-input)] border border-[var(--color-input-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-input-focus)] focus:ring-1 focus:ring-[var(--color-input-focus)] appearance-none cursor-pointer"
            >
              <option value={EVENT_STATUS.UPCOMING}>Upcoming</option>
              <option value={EVENT_STATUS.ONGOING}>Ongoing</option>
              <option value={EVENT_STATUS.COMPLETED}>Completed</option>
              <option value={EVENT_STATUS.CANCELLED}>Cancelled</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            Max Attendees
          </label>
          <div className="relative">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] w-4 h-4 pointer-events-none" />
            <input
              type="number"
              placeholder="Unlimited"
              {...register("maxAttendees", { valueAsNumber: true })}
              className="w-full h-9 pl-9 pr-3 rounded-[var(--radius-md)] bg-[var(--color-input)] border border-[var(--color-input-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-input-focus)] focus:ring-1 focus:ring-[var(--color-input-focus)]"
            />
          </div>
          {errors.maxAttendees && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.maxAttendees.message as React.ReactNode}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
          Total Budget
        </label>
        <div className="relative">
          <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] w-4 h-4 pointer-events-none" />
          <input
            type="number"
            min="0"
            step="100"
            placeholder="e.g. 50000"
            {...register("budget", { valueAsNumber: true })}
            className="w-full h-9 pl-9 pr-3 rounded-[var(--radius-md)] bg-[var(--color-input)] border border-[var(--color-input-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-input-focus)] focus:ring-1 focus:ring-[var(--color-input-focus)]"
          />
        </div>
        {errors.budget && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.budget.message as React.ReactNode}</p>}
      </div>
    </div>
  );
}