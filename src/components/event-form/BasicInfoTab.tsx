import React from 'react';
import Image from 'next/image';
import { Upload, Globe, Activity } from 'lucide-react';
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

  return (
    <div className="space-y-6">
      {/* Event Name */}
      <div>
        <label htmlFor="eventName" className="block text-sm font-medium text-gray-300 mb-2">
          Event Name *
        </label>
        <input
          id="eventName"
          type="text"
          {...register('eventName')}
          className={`w-full px-3 py-2 bg-zinc-700 border rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500 ${errors.eventName ? 'border-red-500' : 'border-zinc-600'}`}
          placeholder="Enter event name"
        />
        {errors.eventName && <p className="text-red-500 text-xs mt-1">{errors.eventName.message}</p>}
      </div>

      {/* Event Banner */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Event Banner
        </label>
        <div className="space-y-3">
          {eventBannerUrl && (
            <div className="relative w-full h-40">
              <Image
                src={eventBannerUrl}
                alt="Event banner"
                fill
                className="object-cover rounded-lg"
              />
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="url"
              aria-label="Event Banner URL"
              placeholder="Or paste banner URL here"
              {...register('eventBannerUrl')}
              className="flex-1 px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg transition-colors shrink-0"
            >
              {isUploading ? (
                <>Loading...</>
              ) : (
                <>
                  <Upload size={16} />
                  Upload
                </>
              )}
            </button>
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
        <label htmlFor="eventDescription" className="block text-sm font-medium text-gray-300 mb-2">
          Description
        </label>
        <textarea
          id="eventDescription"
          {...register('eventDescription')}
          rows={4}
          className={`w-full px-3 py-2 bg-zinc-700 border rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500 ${errors.eventDescription ? 'border-red-500' : 'border-zinc-600'}`}
          placeholder="Describe your event in detail..."
        />
        {errors.eventDescription && <p className="text-red-500 text-xs mt-1">{errors.eventDescription.message}</p>}
      </div>

      {/* Date & Time */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Start Date *
          </label>
          <input
            type="date"
            {...register('startDate')}
            className={`w-full px-3 py-2 bg-zinc-700 border rounded-lg text-white focus:outline-none focus:border-green-500 ${errors.startDate ? 'border-red-500' : 'border-zinc-600'}`}
          />
          {errors.startDate && <p className="text-red-500 text-xs mt-1">{errors.startDate.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Start Time *
          </label>
          <input
            type="time"
            {...register('startTime')}
            className={`w-full px-3 py-2 bg-zinc-700 border rounded-lg text-white focus:outline-none focus:border-green-500 ${errors.startTime ? 'border-red-500' : 'border-zinc-600'}`}
          />
          {errors.startTime && <p className="text-red-500 text-xs mt-1">{errors.startTime.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            End Date *
          </label>
          <input
            type="date"
            {...register('endDate')}
            className={`w-full px-3 py-2 bg-zinc-700 border rounded-lg text-white focus:outline-none focus:border-green-500 ${errors.endDate ? 'border-red-500' : 'border-zinc-600'}`}
          />
          {errors.endDate && <p className="text-red-500 text-xs mt-1">{errors.endDate.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            End Time *
          </label>
          <input
            type="time"
            {...register('endTime')}
            className={`w-full px-3 py-2 bg-zinc-700 border rounded-lg text-white focus:outline-none focus:border-green-500 ${errors.endTime ? 'border-red-500' : 'border-zinc-600'}`}
          />
          {errors.endTime && <p className="text-red-500 text-xs mt-1">{errors.endTime.message}</p>}
        </div>
      </div>

      {/* Organizer Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Organizer Name
          </label>
          <input
            type="text"
            {...register('organizerName')}
            className={`w-full px-3 py-2 bg-zinc-700 border rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500 ${errors.organizerName ? 'border-red-500' : 'border-zinc-600'}`}
            placeholder="Event organizer name"
          />
          {errors.organizerName && <p className="text-red-500 text-xs mt-1">{errors.organizerName.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Organizer Contact
          </label>
          <input
            type="text"
            {...register('organizerContact')}
            className={`w-full px-3 py-2 bg-zinc-700 border rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500 ${errors.organizerContact ? 'border-red-500' : 'border-zinc-600'}`}
            placeholder="Email or phone number"
          />
          {errors.organizerContact && <p className="text-red-500 text-xs mt-1">{errors.organizerContact.message}</p>}
        </div>
      </div>

      {/* Event Settings */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Visibility
          </label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <select
              {...register('visibilityType')}
              className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white"
            >
              <option value={VISIBILITY_TYPES.PUBLIC}>Public</option>
              <option value={VISIBILITY_TYPES.PRIVATE}>Private</option>
              <option value={VISIBILITY_TYPES.WHITELIST}>Whitelist Only</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Max Attendees
          </label>
          <input
            type="number"
            {...register('maxAttendees')}
            className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
            placeholder="Leave empty for unlimited"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Event Status
          </label>
          <div className="relative">
            <Activity className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <select
              {...register('eventStatus')}
              className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white"
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
