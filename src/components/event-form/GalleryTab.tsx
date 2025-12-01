import React from 'react';
import { Plus, Trash2, Upload } from 'lucide-react';
import { EventFormData } from '@/types/events';

interface GalleryTabProps {
  formData: EventFormData;
  updateFormData: (updates: Partial<EventFormData>) => void;
  uploadingGalleryType: 'image' | 'video' | null;
  onGalleryImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onGalleryVideoUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  galleryImageInputRef: React.RefObject<HTMLInputElement | null>;
  galleryVideoInputRef: React.RefObject<HTMLInputElement | null>;
}

export function GalleryTab({
  formData,
  updateFormData,
  uploadingGalleryType,
  onGalleryImageUpload,
  onGalleryVideoUpload,
  galleryImageInputRef,
  galleryVideoInputRef,
}: GalleryTabProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-white">Event Gallery</h3>
      
      {/* Gallery Images */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Gallery Images
        </label>
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="url"
              aria-label="Add image URL"
              placeholder="Add image URL (e.g., https://example.com/image.jpg)"
              className="flex-1 px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const input = e.target as HTMLInputElement;
                  if (input.value.trim()) {
                    updateFormData({ galleryImages: [...formData.galleryImages, input.value.trim()] });
                    input.value = '';
                  }
                }
              }}
            />
            <button
              type="button"
              onClick={(e) => {
                const input = (e.target as HTMLButtonElement).parentElement?.querySelector('input') as HTMLInputElement;
                if (input?.value.trim()) {
                  updateFormData({ galleryImages: [...formData.galleryImages, input.value.trim()] });
                  input.value = '';
                }
              }}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2 shrink-0"
            >
              <Plus size={16} />
              Add
            </button>
            <button
              type="button"
              onClick={() => galleryImageInputRef.current?.click()}
              disabled={uploadingGalleryType === 'image'}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg transition-colors flex items-center gap-2 shrink-0"
            >
              <Upload size={16} />
              Upload
            </button>
            <input
              ref={galleryImageInputRef}
              type="file"
              onChange={onGalleryImageUpload}
              accept="image/*"
              className="hidden"
            />
          </div>
          {formData.galleryImages.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {formData.galleryImages.map((image, index) => {
                return (
                  <div key={index} className="relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image}
                      alt={`Gallery ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg border border-zinc-600 cursor-pointer hover:opacity-80 transition-opacity"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="128" height="128"%3E%3Crect fill="%23333" width="128" height="128"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="14"%3EImage Error%3C/text%3E%3C/svg%3E';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => updateFormData({ galleryImages: formData.galleryImages.filter((_, i) => i !== index) })}
                      className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Gallery Videos */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Gallery Videos
        </label>
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="url"
              aria-label="Add video URL"
              placeholder="Add video URL (YouTube, Vimeo, etc.)"
              className="flex-1 px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const input = e.target as HTMLInputElement;
                  if (input.value.trim()) {
                    updateFormData({ galleryVideos: [...formData.galleryVideos, input.value.trim()] });
                    input.value = '';
                  }
                }
              }}
            />
            <button
              type="button"
              onClick={(e) => {
                const input = (e.target as HTMLButtonElement).parentElement?.querySelector('input') as HTMLInputElement;
                if (input?.value.trim()) {
                  updateFormData({ galleryVideos: [...formData.galleryVideos, input.value.trim()] });
                  input.value = '';
                }
              }}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2 shrink-0"
            >
              <Plus size={16} />
              Add
            </button>
            <button
              type="button"
              onClick={() => galleryVideoInputRef.current?.click()}
              disabled={uploadingGalleryType === 'video'}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg transition-colors flex items-center gap-2 shrink-0"
            >
              <Upload size={16} />
              Upload
            </button>
            <input
              ref={galleryVideoInputRef}
              type="file"
              onChange={onGalleryVideoUpload}
              accept="video/*"
              className="hidden"
            />
          </div>
          {formData.galleryVideos.length > 0 && (
            <div className="space-y-2">
              {formData.galleryVideos.map((video, index) => (
                <div key={index} className="flex items-center justify-between bg-zinc-800 px-3 py-2 rounded-lg">
                  <span className="text-white truncate text-sm">{video}</span>
                  <button
                    type="button"
                    onClick={() => updateFormData({ galleryVideos: formData.galleryVideos.filter((_, i) => i !== index) })}
                    className="text-red-400 hover:text-red-300 p-1 shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
