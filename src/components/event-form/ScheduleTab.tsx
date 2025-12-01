import React from 'react';
import { Plus, Trash2, Upload } from 'lucide-react';
import { EventFormData } from '@/types/events';

interface ScheduleTabProps {
  formData: EventFormData;
  updateFormData: (updates: Partial<EventFormData>) => void;
  uploadingPerformerIndex: number | null;
  onPerformerImageUpload: (event: React.ChangeEvent<HTMLInputElement>, index: number) => void;
  performerImageInputRef: React.RefObject<HTMLInputElement | null>;
}

export function ScheduleTab({
  formData,
  updateFormData,
  uploadingPerformerIndex,
  onPerformerImageUpload,
  performerImageInputRef,
}: ScheduleTabProps) {
  const addScheduleItem = () => {
    updateFormData({
      schedules: [...formData.schedules, {
        day_number: 1,
        start_time: "09:00",
        end_time: "10:00",
        title: "",
        description: "",
        location: "",
      }]
    });
  };

  const addPerformer = () => {
    updateFormData({
      performers: [...formData.performers, {
        name: "",
        bio: "",
        image_url: "",
        performer_type: 'artist',
        social_links: {},
      }]
    });
  };

  return (
    <div className="space-y-8">
      {/* Performers Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-white">Performers & Artists</h3>
          <button
            type="button"
            onClick={addPerformer}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            <Plus size={16} />
            Add Performer
          </button>
        </div>
        {formData.performers.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            No performers added yet. Click &quot;Add Performer&quot; to get started.
          </div>
        ) : (
          <div className="space-y-4">
            {formData.performers.map((performer, index) => (
              <div key={index} className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-white font-medium">Performer {index + 1}</h4>
                  <button
                    type="button"
                    onClick={() => updateFormData({ performers: formData.performers.filter((_, i) => i !== index) })}
                    className="text-red-400 hover:text-red-300 p-1"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor={`performer-name-${index}`} className="block text-sm font-medium text-gray-300 mb-2">
                      Performer Name
                    </label>
                    <input
                      id={`performer-name-${index}`}
                      type="text"
                      value={performer.name}
                      onChange={(e) => {
                        const newPerformers = [...formData.performers];
                        newPerformers[index].name = e.target.value;
                        updateFormData({ performers: newPerformers });
                      }}
                      placeholder="Artist or band name"
                      className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label htmlFor={`performer-type-${index}`} className="block text-sm font-medium text-gray-300 mb-2">
                      Performer Type
                    </label>
                    <select
                      id={`performer-type-${index}`}
                      value={performer.performer_type}
                      onChange={(e) => {
                        const newPerformers = [...formData.performers];
                        newPerformers[index].performer_type = e.target.value as 'artist' | 'speaker' | 'chef' | 'performer' | 'other';
                        updateFormData({ performers: newPerformers });
                      }}
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
                    <label htmlFor={`performer-bio-${index}`} className="block text-sm font-medium text-gray-300 mb-2">
                      Bio/Description
                    </label>
                    <textarea
                      id={`performer-bio-${index}`}
                      value={performer.bio || ''}
                      onChange={(e) => {
                        const newPerformers = [...formData.performers];
                        newPerformers[index].bio = e.target.value;
                        updateFormData({ performers: newPerformers });
                      }}
                      placeholder="Brief biography or description of the performer..."
                      rows={3}
                      className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor={`performer-image-${index}`} className="block text-sm font-medium text-gray-300 mb-2">
                      Image
                    </label>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          id={`performer-image-${index}`}
                          type="url"
                          aria-label="Performer Image URL"
                          value={performer.image_url || ''}
                          onChange={(e) => {
                            const newPerformers = [...formData.performers];
                            newPerformers[index].image_url = e.target.value;
                            updateFormData({ performers: newPerformers });
                          }}
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
                      {performer.image_url && (
                        <div className="relative w-24 h-24">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={performer.image_url}
                            alt={performer.name}
                            className="w-full h-full object-cover rounded-lg"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="96" height="96"%3E%3Crect fill="%23333" width="96" height="96"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="12"%3EError%3C/text%3E%3C/svg%3E';
                            }}
                          />
                        </div>
                      )}
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
            onClick={addScheduleItem}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            <Plus size={16} />
            Add Schedule Item
          </button>
        </div>
        {formData.schedules.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            No schedule items added yet. Click &quot;Add Schedule Item&quot; to get started.
          </div>
        ) : (
          <div className="space-y-4">
            {formData.schedules.map((schedule, index) => (
              <div key={index} className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-white font-medium">Schedule Item {index + 1}</h4>
                  <button
                    type="button"
                    onClick={() => updateFormData({ schedules: formData.schedules.filter((_, i) => i !== index) })}
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
                      value={schedule.day_number}
                      onChange={(e) => {
                        const newSchedules = [...formData.schedules];
                        newSchedules[index].day_number = parseInt(e.target.value);
                        updateFormData({ schedules: newSchedules });
                      }}
                      className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Location
                    </label>
                    <input
                      type="text"
                      value={schedule.location}
                      onChange={(e) => {
                        const newSchedules = [...formData.schedules];
                        newSchedules[index].location = e.target.value;
                        updateFormData({ schedules: newSchedules });
                      }}
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
                      value={schedule.start_time}
                      onChange={(e) => {
                        const newSchedules = [...formData.schedules];
                        newSchedules[index].start_time = e.target.value;
                        updateFormData({ schedules: newSchedules });
                      }}
                      className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={schedule.end_time}
                      onChange={(e) => {
                        const newSchedules = [...formData.schedules];
                        newSchedules[index].end_time = e.target.value;
                        updateFormData({ schedules: newSchedules });
                      }}
                      className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Title
                    </label>
                    <input
                      type="text"
                      value={schedule.title}
                      onChange={(e) => {
                        const newSchedules = [...formData.schedules];
                        newSchedules[index].title = e.target.value;
                        updateFormData({ schedules: newSchedules });
                      }}
                      placeholder="e.g., Opening Ceremony, Keynote Speech"
                      className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Description
                    </label>
                    <textarea
                      value={schedule.description || ''}
                      onChange={(e) => {
                        const newSchedules = [...formData.schedules];
                        newSchedules[index].description = e.target.value;
                        updateFormData({ schedules: newSchedules });
                      }}
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
