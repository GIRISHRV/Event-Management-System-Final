import React from 'react';
import Image from 'next/image';
import { Upload, Globe, Activity, Calendar, Clock, User, Mail, Users } from 'lucide-react';
import { UseFormRegister, FieldErrors, UseFormWatch } from 'react-hook-form';
import { EventFormSchema } from '@/lib/schemas';
import { VISIBILITY_TYPES, EVENT_STATUS } from '@/lib/constants';

interface BasicInfoTabProps {
  register: UseFormRegister<EventFormSchema>;
  errors: FieldErrors<EventFormSchema>;
  watch: UseFormWatch<EventFormSchema>;
  isUploading: boolean;
  onImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export function BasicInfoTab({
  register,
  errors,
  watch,
  isUploading,
  onImageUpload,
  fileInputRef,
}: BasicInfoTabProps) {
  const eventBannerUrl = watch('eventBannerUrl');

  const inputClasses = `
    w-full px-3 py-2.5 bg-zinc-900/50 border rounded-xl text-white placeholder-zinc-500 
    focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 
    transition-all duration-200
  `;
  
  const labelClasses = "block text-sm font-medium text-zinc-400 mb-2 ml-1";

  return (
    <div className="space-y-6">
      {/* Event Name */}
      <div>
        <label htmlFor="eventName" className={labelClasses}>
          Event Name <span className="text-red-400">*</span>
        </label>
        <input
          id="eventName"
          type="text"
          {...register('eventName')}
          className={`${inputClasses} ${errors.eventName ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20' : 'border-zinc-800'}`}
          placeholder="e.g. Tech Conference 2024"
        />
        {errors.eventName && <p className="text-red-400 text-xs mt-2 ml-1">{errors.eventName.message}</p>}
      </div>

      {/* Event Banner */}
      <div>
        <label className={labelClasses}>
          Event Banner
        </label>
        <div className="space-y-4">
          {eventBannerUrl && (
            <div className="relative w-full h-48 group">
              <Image
                src={eventBannerUrl}
                alt="Event banner"
                fill
                className="object-cover rounded-xl border border-zinc-800"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-lg text-white hover:bg-white/20 transition-colors"
                >
                  Change Image
                </button>
              </div>
            </div>
          )}
          
          {!eventBannerUrl && (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-32 border-2 border-dashed border-zinc-800 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-zinc-700 hover:bg-zinc-900/30 transition-all group"
            >
              <Upload className="w-8 h-8 text-zinc-600 group-hover:text-zinc-400 mb-2 transition-colors" />
              <span className="text-sm text-zinc-500 group-hover:text-zinc-400">Click to upload banner</span>
            </div>
          )}

          <div className="flex gap-3">
            <div className="relative flex-1">
              <input
                type="url"
                aria-label="Event Banner URL"
                placeholder="Or paste image URL..."
                {...register('eventBannerUrl')}
                className={`${inputClasses} border-zinc-800`}
              />
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={onImageUpload}
              accept="image/*"
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="eventDescription" className={labelClasses}>
          Description
        </label>
        <textarea
          id="eventDescription"
          {...register('eventDescription')}
          rows={5}
          className={`${inputClasses} ${errors.eventDescription ? 'border-red-500/50' : 'border-zinc-800'} resize-none`}
          placeholder="Describe what makes your event special..."
        />
        {errors.eventDescription && <p className="text-red-400 text-xs mt-2 ml-1">{errors.eventDescription.message}</p>}
      </div>

      {/* Date & Time */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-4 p-4 bg-zinc-900/30 border border-zinc-800/50 rounded-2xl">
          <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2 mb-4">
            <Calendar size={16} className="text-emerald-400" />
            Start Schedule
          </h3>
          <div>
            <label className={labelClasses}>Date</label>
            <input
              type="date"
              {...register('startDate')}
              className={`${inputClasses} border-zinc-800`}
            />
            {errors.startDate && <p className="text-red-400 text-xs mt-2 ml-1">{errors.startDate.message}</p>}
          </div>
          <div>
            <label className={labelClasses}>Time</label>
            <input
              type="time"
              {...register('startTime')}
              className={`${inputClasses} border-zinc-800`}
            />
            {errors.startTime && <p className="text-red-400 text-xs mt-2 ml-1">{errors.startTime.message}</p>}
          </div>
        </div>

        <div className="space-y-4 p-4 bg-zinc-900/30 border border-zinc-800/50 rounded-2xl">
          <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2 mb-4">
            <Clock size={16} className="text-teal-400" />
            End Schedule
          </h3>
          <div>
            <label className={labelClasses}>Date</label>
            <input
              type="date"
              {...register('endDate')}
              className={`${inputClasses} border-zinc-800`}
            />
            {errors.endDate && <p className="text-red-400 text-xs mt-2 ml-1">{errors.endDate.message}</p>}
          </div>
          <div>
            <label className={labelClasses}>Time</label>
            <input
              type="time"
              {...register('endTime')}
              className={`${inputClasses} border-zinc-800`}
            />
            {errors.endTime && <p className="text-red-400 text-xs mt-2 ml-1">{errors.endTime.message}</p>}
          </div>
        </div>
      </div>

      {/* Organizer Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className={labelClasses}>
            Organizer Name
          </label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 w-5 h-5" />
            <input
              type="text"
              {...register('organizerName')}
              className={`${inputClasses} pl-12 border-zinc-800`}
              placeholder="Who is hosting?"
            />
          </div>
          {errors.organizerName && <p className="text-red-400 text-xs mt-2 ml-1">{errors.organizerName.message}</p>}
        </div>
        <div>
          <label className={labelClasses}>
            Organizer Contact
          </label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 w-5 h-5" />
            <input
              type="text"
              {...register('organizerContact')}
              className={`${inputClasses} pl-12 border-zinc-800`}
              placeholder="Contact email or phone"
            />
          </div>
          {errors.organizerContact && <p className="text-red-400 text-xs mt-2 ml-1">{errors.organizerContact.message}</p>}
        </div>
      </div>

      {/* Event Settings */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div>
          <label className={labelClasses}>
            Visibility
          </label>
          <div className="relative">
            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 w-5 h-5 pointer-events-none" />
            <select
              {...register('visibilityType')}
              className={`${inputClasses} pl-12 border-zinc-800 appearance-none cursor-pointer`}
            >
              <option value={VISIBILITY_TYPES.PUBLIC}>Public Event</option>
              <option value={VISIBILITY_TYPES.PRIVATE}>Private Event</option>
              <option value={VISIBILITY_TYPES.WHITELIST}>Invite Only</option>
            </select>
          </div>
        </div>
        <div>
          <label className={labelClasses}>
            Max Attendees
          </label>
          <div className="relative">
            <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 w-5 h-5" />
            <input
              type="number"
              {...register('maxAttendees')}
              className={`${inputClasses} pl-12 border-zinc-800`}
              placeholder="Unlimited"
            />
          </div>
        </div>
        <div>
          <label className={labelClasses}>
            Event Status
          </label>
          <div className="relative">
            <Activity className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 w-5 h-5 pointer-events-none" />
            <select
              {...register('eventStatus')}
              className={`${inputClasses} pl-12 border-zinc-800 appearance-none cursor-pointer`}
            >
              <option value={EVENT_STATUS.UPCOMING}>Upcoming</option>
              <option value={EVENT_STATUS.ONGOING}>Ongoing</option>
              <option value={EVENT_STATUS.COMPLETED}>Completed</option>
              <option value={EVENT_STATUS.CANCELLED}>Cancelled</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
