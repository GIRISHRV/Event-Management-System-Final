import { supabase } from "./client";

/**
 * Centralized file upload/delete service.
 * All Supabase Storage interactions go through this module.
 */
export const storageService = {
  /**
   * Upload a file to a Supabase storage bucket.
   */
  async uploadFile(
    bucket: string,
    file: File,
    options: { folder?: string; path?: string } = {}
  ): Promise<string> {
    const ext = file.name.split(".").pop() ?? "jpg";
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
    const filePath = options.path || (options.folder ? `${options.folder}/${fileName}` : fileName);

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(data.path);

    return publicUrl;
  },

  /**
   * Delete a file from a Supabase storage bucket.
   */
  async deleteFile(bucket: string, path: string): Promise<void> {
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) {
      throw new Error(`Delete failed: ${error.message}`);
    }
  },

  /**
   * Delete public URLs from a bucket by extracting their paths.
   */
  async deletePublicUrls(bucket: string, urls: string[]): Promise<void> {
    const paths = urls
      .map((url) => {
        const match = url.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)/);
        return match?.[1];
      })
      .filter(Boolean) as string[];

    if (paths.length > 0) {
      await supabase.storage.from(bucket).remove(paths);
    }
  }
};

/** Backwards Compatibility Aliases */
export const uploadFile = storageService.uploadFile;
export const deleteFile = storageService.deleteFile;
