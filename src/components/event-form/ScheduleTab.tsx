import React from 'react';
import { Plus, Trash2, Upload } from 'lucide-react';
import { Control, useFieldArray, UseFormRegister } from 'react-hook-form';
import { EventFormSchema } from '@/lib/schemas';

interface ScheduleTabProps {
  control: Control<EventFormSchema>;
  register: UseFormRegister<EventFormSchema>;
  uploadingPerformerIndex: number | null;
  onPerformerImageUpload: (event: React.ChangeEvent<HTMLInputElement>, index: number) => void;
  performerImageInputRef: React.RefObject<HTMLInputElement | null>;
}

export function ScheduleTab({
  control,
  register,
  uploadingPerformerIndex,
  onPerformerImageUpload,
  performerImageInputRef,
}: ScheduleTabProps) {
  const { fields: scheduleFields, append: appendSchedule, remove: removeSchedule } = useFieldArray({
    control,
    name: "schedules"
  });

  const { fields: performerFields, append: appendPerformer, remove: removePerformer } = useFieldArray({
    control,
    name: "performers"
  });

  return (
    <div className="space-y-8">
      {/* Performers Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-white">Performers & Artists</h3>
          <button
            type="button"
            onClick={() => appendPerformer({
              name: "",
              bio: "",
              image_url: "",
              performer_type: 'artist',
              social_links: {},
            })}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            <Plus size={16} />
            Add Performer
          </button>
        </div>
        {performerFields.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            No performers added yet. Click &quot;Add Performer&quot; to get started.
          </div>
        ) : (
          <div className="space-y-4">
            {performerFields.map((field, index) => (
              <div key={field.id} className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-white font-medium">Performer {index + 1}</h4>
                  <button
                    type="button"
                    onClick={() => removePerformer(index)}
                    className="text-red-400 hover:text-red-300 p-1"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Performer Name
                    </label>
                    <input
                      {...register(`performers.${index}.name`)}
                      placeholder="Artist or band name"
                      className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Performer Type
                    </label>
                    <select
                      {...register(`performers.${index}.performer_type`)}
                      className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                    >
                      <option value="artist">Artist</option>
                      <option value="performer">Performer</option>
                      <option value="speaker">Speaker</option>
                      <option value="chef">Chef</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Bio/Description
                    </label>
                    <textarea
                      {...register(`performers.${index}.bio`)}
                      placeholder="Brief biography or description of the performer..."
                      rows={3}
                      className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Image
                    </label>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="url"
                          {...register(`performers.${index}.image_url`)}
                          placeholder="https://example.com/performer-photo.jpg"
                          className="flex-1 px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
                        />
                        <button
                          type="button"
                          onClick={() => performerImageInputRef.current?.click()}
                          disabled={uploadingPerformerIndex === index}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg transition-colors flex items-center gap-2 shrink-0"
                        >
                          <Upload size={16} />
                          Upload
                        </button>
                        <input
                          ref={performerImageInputRef}
                          type="file"
                          onChange={(e) => onPerformerImageUpload(e, index)}
                          accept="image/*"
                          className="hidden"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-zinc-700 pt-8">
        {/* Event Schedule Section */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-white">Event Schedule</h3>
          <button
            type="button"
            onClick={() => appendSchedule({
              day_number: 1,
              start_time: "09:00",
              end_time: "10:00",
              title: "",
              description: "",
              location: "",
            })}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            <Plus size={16} />
            Add Schedule Item
          </button>
        </div>
        {scheduleFields.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            No schedule items added yet. Click &quot;Add Schedule Item&quot; to get started.
          </div>
        ) : (
          <div className="space-y-4">
            {scheduleFields.map((field, index) => (
              <div key={field.id} className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-white font-medium">Schedule Item {index + 1}</h4>
                  <button
                    type="button"
                    onClick={() => removeSchedule(index)}
                    className="text-red-400 hover:text-red-300 p-1"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Day Number
                    </label>
                    <input
                      type="number"
                      min="1"
                      {...register(`schedules.${index}.day_number`, { valueAsNumber: true })}
                      className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Location
                    </label>
                    <input
                      type="text"
                      {...register(`schedules.${index}.location`)}
                      placeholder="e.g., Main Stage, Conference Room A"
                      className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Start Time
                    </label>
                    <input
                      type="time"
                      {...register(`schedules.${index}.start_time`)}
                      className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      End Time
                    </label>
                    <input
                      type="time"
                      {...register(`schedules.${index}.end_time`)}
                      className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Title
                    </label>
                    <input
                      type="text"
                      {...register(`schedules.${index}.title`)}
                      placeholder="e.g., Opening Ceremony, Keynote Speech"
                      className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Description
                    </label>
                    <textarea
                      {...register(`schedules.${index}.description`)}
                      placeholder="Detailed description of this schedule item..."
                      rows={3}
                      className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
