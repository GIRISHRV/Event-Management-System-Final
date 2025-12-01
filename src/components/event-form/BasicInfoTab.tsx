import React from 'react';
import Image from 'next/image';
import { Upload, Globe, Activity } from 'lucide-react';
import { EventFormData } from '@/types/events';
import { VISIBILITY_TYPES, EVENT_STATUS } from '@/lib/constants';

interface BasicInfoTabProps {
  formData: EventFormData;
  updateFormData: (updates: Partial<EventFormData>) => void;
  isUploading: boolean;
  onImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export function BasicInfoTab({
  formData,
  updateFormData,
  isUploading,
  onImageUpload,
  fileInputRef,
}: BasicInfoTabProps) {
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
          value={formData.eventName}
          onChange={(e) => updateFormData({ eventName: e.target.value })}
          required
          className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
          placeholder="Enter event name"
        />
      </div>

      {/* Event Banner */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Event Banner
        </label>
        <div className="space-y-3">
          {formData.eventBannerUrl && (
            <div className="relative w-full h-40">
              <Image
                src={formData.eventBannerUrl}
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
              value={formData.eventBannerUrl}
              onChange={(e) => updateFormData({ eventBannerUrl: e.target.value })}
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
          value={formData.eventDescription}
          onChange={(e) => updateFormData({ eventDescription: e.target.value })}
          rows={4}
          className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
          placeholder="Describe your event in detail..."
        />
      </div>

      {/* Date & Time */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Start Date *
          </label>
          <input
            type="date"
            value={formData.startDate}
            onChange={(e) => updateFormData({ startDate: e.target.value })}
            required
            className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-green-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Start Time *
          </label>
          <input
            type="time"
            value={formData.startTime}
            onChange={(e) => updateFormData({ startTime: e.target.value })}
            required
            className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-green-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            End Date *
          </label>
          <input
            type="date"
            value={formData.endDate}
            onChange={(e) => updateFormData({ endDate: e.target.value })}
            required
            className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-green-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            End Time *
          </label>
          <input
            type="time"
            value={formData.endTime}
            onChange={(e) => updateFormData({ endTime: e.target.value })}
            required
            className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-green-500"
          />
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
            value={formData.organizerName}
            onChange={(e) => updateFormData({ organizerName: e.target.value })}
            className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
            placeholder="Event organizer name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Organizer Contact
          </label>
          <input
            type="text"
            value={formData.organizerContact}
            onChange={(e) => updateFormData({ organizerContact: e.target.value })}
            className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
            placeholder="Email or phone number"
          />
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
              value={formData.visibilityType}
              onChange={(e) => updateFormData({ visibilityType: e.target.value as 'public' | 'private' | 'whitelist' })}
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
            value={formData.maxAttendees}
            onChange={(e) => updateFormData({ maxAttendees: e.target.value })}
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
              value={formData.eventStatus}
              onChange={(e) => updateFormData({ eventStatus: e.target.value as 'upcoming' | 'ongoing' | 'completed' | 'cancelled' })}
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
