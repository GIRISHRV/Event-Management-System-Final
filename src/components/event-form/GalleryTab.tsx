import React, { useState, memo, useCallback, useMemo, useRef } from 'react';
import { Trash2, Upload, ImageOff, Image as ImageIcon, Video } from 'lucide-react';
import { type UseFormReturn } from 'react-hook-form';
import { type EventFormData } from '@/schemas/event.schema';
import Image from 'next/image';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { storageService } from "@/services/supabase/storage";
import { useToast } from "@/hooks/useToast";
import { getErrorMessage } from "@/lib/errors";

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

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove(index);
  };

  return (
    <div className="relative group aspect-video rounded-[var(--radius-lg)] overflow-hidden border border-[var(--color-border)] bg-[var(--color-background)] shadow-sm transition-all hover:border-[var(--color-border-hover)]">
      {hasError ? (
        <div className="w-full h-full flex flex-col items-center justify-center text-[var(--color-text-tertiary)] p-4 text-center bg-[var(--color-surface)]">
          <ImageOff className="w-8 h-8 mb-2 opacity-20" />
          <span className="text-[10px] uppercase tracking-wider font-bold mb-1 text-[var(--color-text-secondary)]">Invalid Image</span>
          <a href={image} target="_blank" rel="noopener noreferrer" className="text-[9px] text-[var(--color-brand)] hover:underline truncate max-w-full">
            Show original
          </a>
        </div>
      ) : (
        <Image
          src={image}
          alt={`Gallery ${index + 1}`}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          onError={() => setHasError(true)}
          unoptimized
        />
      )}
      <button type="button" onClick={handleRemove} className="absolute top-2 right-2 p-1.5 bg-[var(--color-danger)] hover:bg-[var(--color-danger-hover)] text-white rounded-[var(--radius-md)] shadow-lg z-20 transition-all opacity-80 group-hover:opacity-100" title="Remove image">
        <Trash2 size={14} />
      </button>
    </div>
  );
});

const GalleryVideoItem = memo(function GalleryVideoItem({
  video,
  index,
  onRemove,
}: {
  video: string;
  index: number;
  onRemove: (index: number) => void;
}) {
  const [hasError, setHasError] = useState(false);
  const isDirectVideo = useMemo(() => video.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i) || video.includes('supabase.co/storage/v1/object/public/'), [video]);

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove(index);
  };

  return (
    <div className="relative group aspect-video rounded-[var(--radius-lg)] overflow-hidden border border-[var(--color-border)] bg-[var(--color-background)] shadow-sm transition-all hover:border-[var(--color-border-hover)]">
      {isDirectVideo && !hasError ? (
        <video src={video} className="w-full h-full object-cover" onError={() => setHasError(true)} preload="metadata" />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center text-[var(--color-text-tertiary)] p-4 text-center bg-[var(--color-surface)]">
          <Video className="w-8 h-8 mb-2 text-[var(--color-brand)] opacity-50" />
          <span className="text-[10px] uppercase tracking-wider font-bold truncate max-w-full italic px-2 mb-1 text-[var(--color-text-secondary)]">
            {video.split('/').pop()?.split('?')[0] || 'Video Item'}
          </span>
          <a href={video} target="_blank" rel="noopener noreferrer" className="text-[9px] text-[var(--color-brand)] hover:underline truncate max-w-full">
            Open Video
          </a>
        </div>
      )}
      <button type="button" onClick={handleRemove} className="absolute top-2 right-2 p-1.5 bg-[var(--color-danger)] hover:bg-[var(--color-danger-hover)] text-white rounded-[var(--radius-md)] shadow-lg z-20 transition-all opacity-80 group-hover:opacity-100" title="Remove video">
        <Trash2 size={14} />
      </button>
      <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-black/60 text-[10px] font-medium text-white rounded backdrop-blur-sm pointer-events-none z-10">
        VIDEO
      </div>
    </div>
  );
});

interface GalleryTabProps {
  form: UseFormReturn<EventFormData>;
  eventId?: string;
}

export function GalleryTab({ form, eventId }: GalleryTabProps) {
  const { watch, setValue, getValues } = form;
  const { error: toastError, success: toastSuccess } = useToast();

  const [uploadingType, setUploadingType] = useState<'image' | 'video' | null>(null);
  const galleryImageInputRef = useRef<HTMLInputElement>(null);
  const galleryVideoInputRef = useRef<HTMLInputElement>(null);

  const galleryImages = useMemo(() => watch('galleryImages') || [], [watch]);
  const galleryVideos = useMemo(() => watch('galleryVideos') || [], [watch]);

  const addImage = useCallback((url: string) => {
    if (url.trim()) setValue('galleryImages', [...galleryImages, url.trim()], { shouldValidate: true, shouldDirty: true });
  }, [galleryImages, setValue]);

  const removeImage = useCallback((index: number) => {
    setValue('galleryImages', galleryImages.filter((_, i) => i !== index), { shouldValidate: true, shouldDirty: true });
  }, [galleryImages, setValue]);

  const addVideo = useCallback((url: string) => {
    if (url.trim()) setValue('galleryVideos', [...galleryVideos, url.trim()], { shouldValidate: true, shouldDirty: true });
  }, [galleryVideos, setValue]);

  const removeVideo = useCallback((index: number) => {
    setValue('galleryVideos', galleryVideos.filter((_, i) => i !== index), { shouldValidate: true, shouldDirty: true });
  }, [galleryVideos, setValue]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingType('image');
      const url = await storageService.uploadFile('events', file, { folder: eventId || 'new-event/gallery' });
      const currentImages = getValues('galleryImages') || [];
      setValue('galleryImages', [...currentImages, url], { shouldValidate: true, shouldDirty: true });
      toastSuccess("Gallery image uploaded");
    } catch (error: unknown) {
      toastError(getErrorMessage(error, "Failed to upload image"));
    } finally {
      setUploadingType(null);
      if (galleryImageInputRef.current) galleryImageInputRef.current.value = '';
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingType('video');
      const url = await storageService.uploadFile('events', file, { folder: eventId || 'new-event/videos' });
      const currentVideos = getValues('galleryVideos') || [];
      setValue('galleryVideos', [...currentVideos, url], { shouldValidate: true, shouldDirty: true });
      toastSuccess("Video uploaded");
    } catch (error: unknown) {
      toastError(getErrorMessage(error, "Failed to upload video"));
    } finally {
      setUploadingType(null);
      if (galleryVideoInputRef.current) galleryVideoInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
              <ImageIcon className="text-[var(--color-brand)]" size={20} />
              Photo Gallery
            </h3>
            <p className="text-sm text-[var(--color-text-tertiary)] mt-1">Showcase your event with high-quality images</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Input
                label="Add Image URL"
                type="url"
                placeholder="Paste image URL..."
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const input = e.target as HTMLInputElement;
                    addImage(input.value);
                    input.value = '';
                  }
                }}
              />
            </div>
            <Button type="button" variant="secondary" onClick={(e) => {
              const input = (e.target as HTMLButtonElement).parentElement?.parentElement?.querySelector('input') as HTMLInputElement;
              addImage(input?.value || '');
              if (input) input.value = '';
            }}>Add</Button>
            <Button type="button" variant="primary" disabled={uploadingType === 'image'} onClick={() => galleryImageInputRef.current?.click()}>
              {uploadingType === 'image' ? "Uploading..." : <><Upload className="w-4 h-4 mr-2" /> Upload</>}
            </Button>
            <input ref={galleryImageInputRef} type="file" onChange={handleImageUpload} accept="image/*" className="hidden" />
          </div>

          {galleryImages.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-[var(--color-border)] rounded-[var(--radius-lg)] bg-[var(--color-surface)]">
              <ImageIcon className="w-12 h-12 text-[var(--color-text-tertiary)] mx-auto mb-3" />
              <p className="text-sm text-[var(--color-text-secondary)]">No images added yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {galleryImages.map((image, index) => (
                <GalleryImageItem key={image} image={image} index={index} onRemove={removeImage} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="h-px bg-[var(--color-border)]" />

      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
              <Video className="text-[var(--color-success)]" size={20} />
              Video Gallery
            </h3>
            <p className="text-sm text-[var(--color-text-tertiary)] mt-1">Add video highlights or teasers</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Input
                label="Add Video URL"
                type="url"
                placeholder="Paste video URL..."
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const input = e.target as HTMLInputElement;
                    addVideo(input.value);
                    input.value = '';
                  }
                }}
              />
            </div>
            <Button type="button" variant="secondary" onClick={(e) => {
              const input = (e.target as HTMLButtonElement).parentElement?.parentElement?.querySelector('input') as HTMLInputElement;
              addVideo(input?.value || '');
              if (input) input.value = '';
            }}>Add</Button>
            <Button type="button" variant="primary" disabled={uploadingType === 'video'} onClick={() => galleryVideoInputRef.current?.click()}>
              {uploadingType === 'video' ? "Uploading..." : <><Upload className="w-4 h-4 mr-2" /> Upload</>}
            </Button>
            <input ref={galleryVideoInputRef} type="file" onChange={handleVideoUpload} accept="video/*" className="hidden" />
          </div>

          {galleryVideos.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-[var(--color-border)] rounded-[var(--radius-lg)] bg-[var(--color-surface)]">
              <Video className="w-12 h-12 text-[var(--color-text-tertiary)] mx-auto mb-3" />
              <p className="text-[var(--color-text-secondary)] text-sm">No videos added yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {galleryVideos.map((video, index) => (
                <GalleryVideoItem key={video} video={video} index={index} onRemove={removeVideo} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}