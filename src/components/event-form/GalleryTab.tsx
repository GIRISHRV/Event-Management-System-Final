import React, { useState, memo, useCallback, useMemo } from 'react';
import { Plus, Trash2, Upload, ImageOff, Image as ImageIcon, Video } from 'lucide-react';
import { UseFormWatch, UseFormSetValue } from 'react-hook-form';
import { EventFormSchema } from '@/lib/schemas';
import Image from 'next/image';

// Memoized gallery image item for performance
const GalleryImageItem = memo(function GalleryImageItem({
  image,
  index,
  onRemove,
}: {
  image: string;
  index: number;
  onRemove: (index: number) => void;
}) {
  const [hasError, setHasError] = useState(false);

  const handleRemove = useCallback(() => {
    onRemove(index);
  }, [onRemove, index]);

  return (
    <div className="relative group aspect-video rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900">
      {hasError ? (
        <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500">
          <ImageOff className="w-8 h-8 mb-2" />
          <span className="text-xs">Failed to load</span>
        </div>
      ) : (
        <>
          <Image
            src={image}
            alt={`Gallery ${index + 1}`}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-110"
            onError={() => setHasError(true)}
            unoptimized={image.startsWith('data:') || image.startsWith('blob:')}
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <button
              type="button"
              onClick={handleRemove}
              className="p-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full transform scale-90 group-hover:scale-100 transition-all"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </>
      )}
    </div>
  );
});

interface GalleryTabProps {
  watch: UseFormWatch<EventFormSchema>;
  setValue: UseFormSetValue<EventFormSchema>;
  uploadingGalleryType: 'image' | 'video' | null;
  onGalleryImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onGalleryVideoUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  galleryImageInputRef: React.RefObject<HTMLInputElement | null>;
  galleryVideoInputRef: React.RefObject<HTMLInputElement | null>;
}

export function GalleryTab({
  watch,
  setValue,
  uploadingGalleryType,
  onGalleryImageUpload,
  onGalleryVideoUpload,
  galleryImageInputRef,
  galleryVideoInputRef,
}: GalleryTabProps) {
  const watchedGalleryImages = watch('galleryImages');
  const watchedGalleryVideos = watch('galleryVideos');
  
  // Memoize arrays to prevent useCallback dependency issues
  const galleryImages = useMemo(() => watchedGalleryImages || [], [watchedGalleryImages]);
  const galleryVideos = useMemo(() => watchedGalleryVideos || [], [watchedGalleryVideos]);

  const addImage = useCallback((url: string) => {
    if (url.trim()) {
      setValue('galleryImages', [...galleryImages, url.trim()], { shouldValidate: true, shouldDirty: true });
    }
  }, [galleryImages, setValue]);

  const removeImage = useCallback((index: number) => {
    setValue('galleryImages', galleryImages.filter((_, i) => i !== index), { shouldValidate: true, shouldDirty: true });
  }, [galleryImages, setValue]);

  const addVideo = useCallback((url: string) => {
    if (url.trim()) {
      setValue('galleryVideos', [...galleryVideos, url.trim()], { shouldValidate: true, shouldDirty: true });
    }
  }, [galleryVideos, setValue]);

  const removeVideo = useCallback((index: number) => {
    setValue('galleryVideos', galleryVideos.filter((_, i) => i !== index), { shouldValidate: true, shouldDirty: true });
  }, [galleryVideos, setValue]);

  const inputClasses = `
    flex-1 px-3 py-2.5 bg-zinc-900/50 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 
    focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 
    transition-all duration-200
  `;

  return (
    <div className="space-y-8">
      {/* Gallery Images */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <ImageIcon className="text-emerald-400" size={20} />
              Photo Gallery
            </h3>
            <p className="text-sm text-zinc-400 mt-1">Showcase your event with high-quality images</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex gap-3">
            <input
              type="url"
              aria-label="Add image URL"
              placeholder="Paste image URL..."
              className={inputClasses}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const input = e.target as HTMLInputElement;
                  addImage(input.value);
                  input.value = '';
                }
              }}
            />
            <button
              type="button"
              onClick={(e) => {
                const input = (e.target as HTMLButtonElement).parentElement?.querySelector('input') as HTMLInputElement;
                addImage(input?.value || '');
                if (input) input.value = '';
              }}
              className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors font-medium"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => galleryImageInputRef.current?.click()}
              disabled={uploadingGalleryType === 'image'}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 text-white rounded-xl transition-colors flex items-center gap-2 font-medium shadow-lg shadow-emerald-500/20"
            >
              {uploadingGalleryType === 'image' ? (
                <span className="animate-pulse">Uploading...</span>
              ) : (
                <>
                  <Upload size={18} />
                  Upload
                </>
              )}
            </button>
            <input
              ref={galleryImageInputRef}
              type="file"
              onChange={onGalleryImageUpload}
              accept="image/*"
              className="hidden"
            />
          </div>

          {galleryImages.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-zinc-800 rounded-2xl bg-zinc-900/20">
              <ImageIcon className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500">No images added yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {galleryImages.map((image, index) => (
                <GalleryImageItem
                  key={index}
                  image={image}
                  index={index}
                  onRemove={removeImage}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-zinc-800" />

      {/* Gallery Videos */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Video className="text-teal-400" size={20} />
              Video Gallery
            </h3>
            <p className="text-sm text-zinc-400 mt-1">Add video highlights or teasers</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex gap-3">
            <input
              type="url"
              aria-label="Add video URL"
              placeholder="Paste video URL..."
              className={inputClasses}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const input = e.target as HTMLInputElement;
                  addVideo(input.value);
                  input.value = '';
                }
              }}
            />
            <button
              type="button"
              onClick={(e) => {
                const input = (e.target as HTMLButtonElement).parentElement?.querySelector('input') as HTMLInputElement;
                addVideo(input?.value || '');
                if (input) input.value = '';
              }}
              className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors font-medium"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => galleryVideoInputRef.current?.click()}
              disabled={uploadingGalleryType === 'video'}
              className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:bg-teal-600/50 text-white rounded-xl transition-colors flex items-center gap-2 font-medium shadow-lg shadow-teal-500/20"
            >
              {uploadingGalleryType === 'video' ? (
                <span className="animate-pulse">Uploading...</span>
              ) : (
                <>
                  <Upload size={18} />
                  Upload
                </>
              )}
            </button>
            <input
              ref={galleryVideoInputRef}
              type="file"
              onChange={onGalleryVideoUpload}
              accept="video/*"
              className="hidden"
            />
          </div>

          {galleryVideos.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-zinc-800 rounded-2xl bg-zinc-900/20">
              <Video className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500">No videos added yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {galleryVideos.map((video, index) => (
                <div key={index} className="flex items-center gap-4 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 group hover:border-zinc-700 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-500">
                    <Video size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm text-zinc-300 font-medium">{video}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeVideo(index)}
                    className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
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
