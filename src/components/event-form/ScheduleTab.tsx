import React, { useState, useRef } from 'react';
import { Plus, Trash2, Upload, User, Calendar, Clock, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import { Control, useFieldArray, UseFormRegister, useWatch } from 'react-hook-form';
import { EventFormSchema } from '@/lib/schemas';

interface ScheduleTabProps {
  control: Control<EventFormSchema>;
  register: UseFormRegister<EventFormSchema>;
  uploadingPerformerIndex: number | null;
  onPerformerImageUpload: (event: React.ChangeEvent<HTMLInputElement>, index: number) => void;
  performerImageInputRef: React.RefObject<HTMLInputElement | null>;
}

const PerformerItem = ({ 
  index, 
  control,
  register, 
  remove, 
  uploadingPerformerIndex, 
  onPerformerImageUpload 
}: {
  index: number;
  control: Control<EventFormSchema>;
  register: UseFormRegister<EventFormSchema>;
  remove: (index: number) => void;
  uploadingPerformerIndex: number | null;
  onPerformerImageUpload: (event: React.ChangeEvent<HTMLInputElement>, index: number) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const performerName = useWatch({
    control,
    name: `performers.${index}.name`,
    defaultValue: ""
  });

  const inputClasses = `
    w-full px-3 py-2.5 bg-zinc-900/50 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 
    focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 
    transition-all duration-200
  `;
  
  const labelClasses = "block text-sm font-medium text-zinc-400 mb-2 ml-1";

  return (
    <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl overflow-hidden group hover:border-zinc-700 transition-colors">
      <div 
        className="flex items-center justify-between p-4 cursor-pointer bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
           <span className="px-2 py-1 bg-zinc-800 rounded text-xs font-medium text-zinc-400">
             {performerName || `Performer ${index + 1}`}
           </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); remove(index); }}
            className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <Trash2 size={18} />
          </button>
          {isOpen ? <ChevronUp size={18} className="text-zinc-500" /> : <ChevronDown size={18} className="text-zinc-500" />}
        </div>
      </div>

      {isOpen && (
        <div className="p-5 border-t border-zinc-800">
           <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Image Upload Section */}
              <div className="md:col-span-3">
                <label className={labelClasses}>Photo</label>
                <div className="space-y-3">
                  <div className="aspect-square rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden relative group/image">
                    <div className="absolute inset-0 flex items-center justify-center text-zinc-700">
                      <User size={32} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingPerformerIndex === index}
                      className="flex-1 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Upload size={14} />
                      Upload
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={(e) => onPerformerImageUpload(e, index)}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>
                  <input
                    type="url"
                    {...register(`performers.${index}.image_url`)}
                    placeholder="Or paste image URL"
                    className="w-full px-3 py-2 bg-zinc-900/50 border border-zinc-800 rounded-lg text-xs text-zinc-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Details Section */}
              <div className="md:col-span-9 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClasses}>Name</label>
                    <input
                      {...register(`performers.${index}.name`)}
                      placeholder="Artist or band name"
                      className={inputClasses}
                    />
                  </div>
                  <div>
                    <label className={labelClasses}>Role</label>
                    <div className="relative">
                      <select
                        {...register(`performers.${index}.performer_type`)}
                        className={`${inputClasses} appearance-none cursor-pointer`}
                      >
                        <option value="artist">Artist</option>
                        <option value="performer">Performer</option>
                        <option value="speaker">Speaker</option>
                        <option value="chef">Chef</option>
                        <option value="other">Other</option>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                        <User size={16} />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className={labelClasses}>Bio</label>
                  <textarea
                    {...register(`performers.${index}.bio`)}
                    placeholder="Brief biography..."
                    rows={3}
                    className={`${inputClasses} resize-none`}
                  />
                </div>
              </div>
            </div>
        </div>
      )}
    </div>
  );
};

const ScheduleItem = ({ 
  index, 
  control,
  register, 
  remove 
}: {
  index: number;
  control: Control<EventFormSchema>;
  register: UseFormRegister<EventFormSchema>;
  remove: (index: number) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const scheduleTitle = useWatch({
    control,
    name: `schedules.${index}.title`,
    defaultValue: ""
  });

  const inputClasses = `
    w-full px-3 py-2.5 bg-zinc-900/50 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 
    focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 
    transition-all duration-200
  `;
  
  const labelClasses = "block text-sm font-medium text-zinc-400 mb-2 ml-1";

  return (
    <div className="relative pl-16">
      {/* Timeline Dot */}
      <div className="absolute left-[29px] top-8 w-3 h-3 rounded-full bg-zinc-800 border-2 border-zinc-600 z-10" />
      
      <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl overflow-hidden group hover:border-zinc-700 transition-colors">
        <div 
          className="flex items-center justify-between p-4 cursor-pointer bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors"
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="flex items-center gap-3">
            <span className="px-2 py-1 bg-zinc-800 rounded text-xs font-medium text-zinc-400">
              {scheduleTitle || `Item ${index + 1}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); remove(index); }}
              className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <Trash2 size={16} />
            </button>
            {isOpen ? <ChevronUp size={18} className="text-zinc-500" /> : <ChevronDown size={18} className="text-zinc-500" />}
          </div>
        </div>

        {isOpen && (
          <div className="p-5 border-t border-zinc-800">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Time & Location */}
              <div className="md:col-span-4 space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Start</label>
                    <input
                      type="time"
                      {...register(`schedules.${index}.start_time`)}
                      className={`${inputClasses} py-2 px-3 text-sm`}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">End</label>
                    <input
                      type="time"
                      {...register(`schedules.${index}.end_time`)}
                      className={`${inputClasses} py-2 px-3 text-sm`}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Day</label>
                  <input
                    type="number"
                    min="1"
                    {...register(`schedules.${index}.day_number`, { valueAsNumber: true })}
                    className={`${inputClasses} py-2 px-3 text-sm`}
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-3 h-3" />
                    <input
                      type="text"
                      {...register(`schedules.${index}.location`)}
                      placeholder="Room/Stage"
                      className={`${inputClasses} py-2 pl-8 pr-3 text-sm`}
                    />
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="md:col-span-8 space-y-4">
                <div>
                  <label className={labelClasses}>Title</label>
                  <input
                    type="text"
                    {...register(`schedules.${index}.title`)}
                    placeholder="Session title"
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label className={labelClasses}>Description</label>
                  <textarea
                    {...register(`schedules.${index}.description`)}
                    placeholder="What is this session about?"
                    rows={3}
                    className={`${inputClasses} resize-none`}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <User className="text-emerald-400" size={20} />
              Performers & Artists
            </h3>
            <p className="text-sm text-zinc-400 mt-1">Add speakers, artists, or special guests</p>
          </div>
          <button
            type="button"
            onClick={() => appendPerformer({
              name: "",
              bio: "",
              image_url: "",
              performer_type: 'artist',
              social_links: {},
            })}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg transition-all hover:scale-105"
          >
            <Plus size={16} />
            Add Performer
          </button>
        </div>

        {performerFields.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-zinc-800 rounded-2xl bg-zinc-900/20">
            <User className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-500">No performers added yet</p>
            <button
              type="button"
              onClick={() => appendPerformer({
                name: "",
                bio: "",
                image_url: "",
                performer_type: 'artist',
                social_links: {},
              })}
              className="text-emerald-400 hover:text-emerald-300 text-sm mt-2 font-medium"
            >
              Add your first performer
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {performerFields.map((field, index) => (
              <PerformerItem
                key={field.id}
                index={index}
                control={control}
                register={register}
                remove={removePerformer}
                uploadingPerformerIndex={uploadingPerformerIndex}
                onPerformerImageUpload={onPerformerImageUpload}
              />
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-zinc-800" />

      {/* Event Schedule Section */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Calendar className="text-teal-400" size={20} />
              Event Schedule
            </h3>
            <p className="text-sm text-zinc-400 mt-1">Plan your event timeline</p>
          </div>
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
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg transition-all hover:scale-105"
          >
            <Plus size={16} />
            Add Item
          </button>
        </div>

        {scheduleFields.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-zinc-800 rounded-2xl bg-zinc-900/20">
            <Clock className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-500">No schedule items added yet</p>
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
              className="text-emerald-400 hover:text-emerald-300 text-sm mt-2 font-medium"
            >
              Create your first schedule item
            </button>
          </div>
        ) : (
          <div className="space-y-4 relative before:absolute before:left-8 before:top-4 before:bottom-4 before:w-px before:bg-zinc-800">
            {scheduleFields.map((field, index) => (
              <ScheduleItem
                key={field.id}
                index={index}
                control={control}
                register={register}
                remove={removeSchedule}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
