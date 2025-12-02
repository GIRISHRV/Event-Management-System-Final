import React, { useState, memo, useCallback, useMemo } from 'react';
import { Plus, Trash2, Upload, ImageOff } from 'lucide-react';
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
    <div className="relative group">
      {hasError ? (
        <div className="w-full h-32 flex items-center justify-center bg-zinc-800 rounded-lg border border-zinc-600">
          <ImageOff className="w-8 h-8 text-zinc-500" />
        </div>
      ) : (
        <Image
          src={image}
          alt={`Gallery ${index + 1}`}
          width={256}
          height={128}
          className="w-full h-32 object-cover rounded-lg border border-zinc-600 cursor-pointer hover:opacity-80 transition-opacity"
          onError={() => setHasError(true)}
          unoptimized={image.startsWith('data:') || image.startsWith('blob:')}
        />
      )}
      <button
        type="button"
        onClick={handleRemove}
        className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Trash2 size={14} />
      </button>
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
          {galleryImages.length > 0 && (
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
              placeholder="Add video URL (e.g., https://example.com/video.mp4)"
              className="flex-1 px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
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
          {galleryVideos.length > 0 && (
            <div className="space-y-2">
              {galleryVideos.map((video, index) => (
                <div key={index} className="flex items-center gap-2 bg-zinc-800 p-2 rounded-lg border border-zinc-700">
                  <div className="flex-1 truncate text-sm text-gray-300">{video}</div>
                  <button
                    type="button"
                    onClick={() => removeVideo(index)}
                    className="text-red-400 hover:text-red-300 p-1"
                  >
                    <Trash2 size={16} />
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
