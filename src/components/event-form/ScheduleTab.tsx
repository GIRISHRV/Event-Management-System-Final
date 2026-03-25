import React, { useState, useRef } from 'react';
import { Plus, Trash2, Upload, User, Calendar, Clock, MapPin, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useFieldArray, useWatch, type UseFormReturn } from 'react-hook-form';
import { type EventFormData } from '@/schemas/event.schema';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { storageService } from "@/services/supabase/storage";
import { useToast } from "@/hooks/useToast";
import { getErrorMessage } from "@/lib/errors";

interface ScheduleTabProps {
  form: UseFormReturn<EventFormData>;
  eventId?: string;
}

const PerformerItem = ({
  index,
  form,
  remove,
  eventId
}: {
  index: number;
  form: UseFormReturn<EventFormData>;
  remove: (index: number) => void;
  eventId?: string;
}) => {
  const { control, register, setValue, formState: { errors } } = form;
  const { error: toastError, success: toastSuccess } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const performerName = useWatch({ control, name: `performers.${index}.name`, defaultValue: "" });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const url = await storageService.uploadFile('events', file, {
        folder: eventId || 'new-event/performers'
      });
      setValue(`performers.${index}.image_url`, url, { shouldValidate: true, shouldDirty: true });
      toastSuccess("Performer image uploaded");
    } catch (error: unknown) {
      toastError(getErrorMessage(error, "Failed to upload performer image"));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] overflow-hidden group hover:border-[var(--color-border-hover)] transition-colors">
      <div
        className="flex items-center justify-between p-4 cursor-pointer bg-[var(--color-surface-hover)] transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <span className="px-2 py-1 bg-[var(--color-background)] rounded text-xs font-medium text-[var(--color-text-secondary)]">
            {performerName || `Performer ${index + 1}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={(e) => { e.stopPropagation(); remove(index); }} className="p-2 text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-muted)] rounded-[var(--radius-md)] transition-colors">
            <Trash2 size={18} />
          </button>
          {isOpen ? <ChevronUp size={18} className="text-[var(--color-text-tertiary)]" /> : <ChevronDown size={18} className="text-[var(--color-text-tertiary)]" />}
        </div>
      </div>

      {isOpen && (
        <div className="p-5 border-t border-[var(--color-border)]">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-3 space-y-3">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Photo</label>
              <div className="aspect-square rounded-[var(--radius-md)] bg-[var(--color-background)] border border-[var(--color-border)] overflow-hidden relative">
                <div className="absolute inset-0 flex items-center justify-center text-[var(--color-text-tertiary)]">
                  <User size={32} />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex-1 px-3 py-2 bg-[var(--color-surface-hover)] hover:bg-[var(--color-border)] text-xs text-[var(--color-text-primary)] rounded-[var(--radius-sm)] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {isUploading ? "Uploading" : "Upload"}
                </button>
                <input ref={fileInputRef} type="file" onChange={handleImageUpload} accept="image/*" className="hidden" />
              </div>
              <Input type="url" placeholder="Or paste image URL" {...register(`performers.${index}.image_url`)} error={errors.performers?.[index]?.image_url?.message as string} />
            </div>

            <div className="md:col-span-9 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Name" placeholder="Artist or band name" {...register(`performers.${index}.name`)} error={errors.performers?.[index]?.name?.message as string} />
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">Role</label>
                  <div className="relative">
                    <select {...register(`performers.${index}.role`)} className="w-full h-9 px-3 rounded-[var(--radius-md)] bg-[var(--color-input)] border border-[var(--color-input-border)] text-sm text-[var(--color-text-primary)] appearance-none focus:outline-none focus:border-[var(--color-input-focus)] focus:ring-1 focus:ring-[var(--color-input-focus)] cursor-pointer">
                      <option value="artist">Artist</option>
                      <option value="performer">Performer</option>
                      <option value="speaker">Speaker</option>
                      <option value="chef">Chef</option>
                      <option value="other">Other</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-tertiary)]">
                      <User size={16} />
                    </div>
                  </div>
                </div>
              </div>
              <Textarea label="Bio" placeholder="Brief biography..." rows={3} {...register(`performers.${index}.bio`)} error={errors.performers?.[index]?.bio?.message as string} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ScheduleItem = ({
  index,
  form,
  remove
}: {
  index: number;
  form: UseFormReturn<EventFormData>;
  remove: (index: number) => void;
}) => {
  const { control, register, formState: { errors } } = form;
  const [isOpen, setIsOpen] = useState(false);

  const scheduleTitle = useWatch({ control, name: `schedules.${index}.title`, defaultValue: "" });

  return (
    <div className="relative pl-12 lg:pl-16">
      <div className="absolute left-[20px] lg:left-[29px] top-8 w-3 h-3 rounded-full bg-[var(--color-background)] border-2 border-[var(--color-brand)] z-10" />
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] overflow-hidden group hover:border-[var(--color-border-hover)] transition-colors">
        <div className="flex items-center justify-between p-4 cursor-pointer bg-[var(--color-surface-hover)] transition-colors" onClick={() => setIsOpen(!isOpen)}>
          <div className="flex items-center gap-3">
            <span className="px-2 py-1 bg-[var(--color-background)] rounded text-xs font-medium text-[var(--color-text-secondary)]">
              {scheduleTitle || `Item ${index + 1}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={(e) => { e.stopPropagation(); remove(index); }} className="p-2 text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-muted)] rounded-[var(--radius-md)] transition-colors">
              <Trash2 size={16} />
            </button>
            {isOpen ? <ChevronUp size={18} className="text-[var(--color-text-tertiary)]" /> : <ChevronDown size={18} className="text-[var(--color-text-tertiary)]" />}
          </div>
        </div>

        {isOpen && (
          <div className="p-5 border-t border-[var(--color-border)]">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              <div className="md:col-span-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Start" type="time" {...register(`schedules.${index}.start_time`)} error={errors.schedules?.[index]?.start_time?.message as string} />
                  <Input label="End" type="time" {...register(`schedules.${index}.end_time`)} error={errors.schedules?.[index]?.end_time?.message as string} />
                </div>
                <Input label="Day Number" type="number" min="1" {...register(`schedules.${index}.day_number`, { valueAsNumber: true })} error={errors.schedules?.[index]?.day_number?.message as string} />
                <div className="relative">
                  <MapPin className="absolute left-3 top-[34px] text-[var(--color-text-tertiary)] w-4 h-4 pointer-events-none" />
                  <Input label="Location" type="text" placeholder="Room/Stage" className="pl-9" {...register(`schedules.${index}.location`)} error={errors.schedules?.[index]?.location?.message as string} />
                </div>
              </div>
              <div className="md:col-span-8 space-y-4">
                <Input label="Title" placeholder="Session title" {...register(`schedules.${index}.title`)} error={errors.schedules?.[index]?.title?.message as string} />
                <Textarea label="Description" placeholder="What is this session about?" rows={3} {...register(`schedules.${index}.description`)} error={errors.schedules?.[index]?.description?.message as string} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export function ScheduleTab({ form, eventId }: ScheduleTabProps) {
  const { control } = form;
  const { fields: scheduleFields, append: appendSchedule, remove: removeSchedule } = useFieldArray({ control, name: "schedules" });
  const { fields: performerFields, append: appendPerformer, remove: removePerformer } = useFieldArray({ control, name: "performers" });

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
              <User className="text-[var(--color-brand)]" size={20} /> Performers & Artists
            </h3>
            <p className="text-sm text-[var(--color-text-tertiary)] mt-1">Add speakers, artists, or special guests</p>
          </div>
          <button type="button" onClick={() => appendPerformer({ name: "", bio: "", image_url: "", role: "artist", social_links: {} })} className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] rounded-[var(--radius-md)] transition-colors">
            <Plus size={16} /> Add Performer
          </button>
        </div>

        {performerFields.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-[var(--color-border)] rounded-[var(--radius-lg)] bg-[var(--color-surface)]">
            <User className="w-10 h-10 text-[var(--color-text-tertiary)] mx-auto mb-3" />
            <p className="text-sm text-[var(--color-text-secondary)]">No performers added yet</p>
            <button type="button" onClick={() => appendPerformer({ name: "", bio: "", image_url: "", role: "artist", social_links: {} })} className="text-sm text-[var(--color-brand)] hover:underline mt-2 font-medium">Add your first performer</button>
          </div>
        ) : (
          <div className="space-y-4">
            {performerFields.map((field, index) => (
              <PerformerItem key={field.id} index={index} form={form} remove={removePerformer} eventId={eventId} />
            ))}
          </div>
        )}
      </div>

      <div className="h-px bg-[var(--color-border)]" />

      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
              <Calendar className="text-[var(--color-success)]" size={20} /> Event Schedule
            </h3>
            <p className="text-sm text-[var(--color-text-tertiary)] mt-1">Plan your event timeline</p>
          </div>
          <button type="button" onClick={() => appendSchedule({ day_number: 1, start_time: "09:00", end_time: "10:00", title: "", description: "", location: "" })} className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] rounded-[var(--radius-md)] transition-colors">
            <Plus size={16} /> Add Session
          </button>
        </div>

        {scheduleFields.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-[var(--color-border)] rounded-[var(--radius-lg)] bg-[var(--color-surface)]">
            <Clock className="w-10 h-10 text-[var(--color-text-tertiary)] mx-auto mb-3" />
            <p className="text-sm text-[var(--color-text-secondary)]">No schedule items added yet</p>
            <button type="button" onClick={() => appendSchedule({ day_number: 1, start_time: "09:00", end_time: "10:00", title: "", description: "", location: "" })} className="text-sm text-[var(--color-brand)] hover:underline mt-2 font-medium">Create your first schedule item</button>
          </div>
        ) : (
          <div className="space-y-4 relative before:absolute before:left-[25px] lg:before:left-[34px] before:top-4 before:bottom-4 before:w-px before:bg-[var(--color-border)]">
            {scheduleFields.map((field, index) => (
              <ScheduleItem key={field.id} index={index} form={form} remove={removeSchedule} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}