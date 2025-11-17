"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { X, Upload } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Event, CreateEventInput } from "@/lib/supabase-types";

interface EventFormProps {
  event?: Event;
  onSubmit: (data: CreateEventInput) => Promise<void>;
  onClose: () => void;
  isLoading?: boolean;
  userEmail?: string;
}

export function EventForm({
  event,
  onSubmit,
  onClose,
  isLoading = false,
  userEmail = "",
}: EventFormProps) {
  const [formData, setFormData] = useState<CreateEventInput>({
    event_name: event?.event_name || "",
    event_description: event?.event_description || "",
    start_date: event?.start_date || "",
    start_time: event?.start_time || "",
    end_date: event?.end_date || "",
    end_time: event?.end_time || "",
    timezone: event?.timezone || "UTC",
    event_banner_url: event?.event_banner_url || "",
  });

  const [error, setError] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>(
    event?.event_banner_url || ""
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("Image size must be less than 5MB");
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file");
      return;
    }

    setUploadingImage(true);
    setError("");

    try {
      // Create a unique file name
      const timestamp = Date.now();
      const filename = `event-banner-${timestamp}-${Math.random().toString(36).substring(7)}`;
      const filepath = `event-banners/${filename}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("event-banners")
        .upload(filepath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage
        .from("event-banners")
        .getPublicUrl(filepath);

      if (data?.publicUrl) {
        setFormData((prev) => ({
          ...prev,
          event_banner_url: data.publicUrl,
        }));
        setImagePreview(data.publicUrl);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to upload image"
      );
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (
      !formData.event_name ||
      !formData.start_date ||
      !formData.start_time ||
      !formData.end_date ||
      !formData.end_time
    ) {
      setError("Please fill in all required fields");
      return;
    }

    // Prevent submit while uploading
    if (uploadingImage) {
      setError("Please wait for image upload to complete");
      return;
    }

    try {
      await onSubmit(formData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred while saving the event";
      setError(errorMessage);
      console.error("Form submission error:", err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-zinc-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-zinc-700 sticky top-0 bg-white dark:bg-zinc-900">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {event ? "Edit Event" : "Create New Event"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-zinc-400 hover:text-gray-600 dark:hover:text-white transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/50 rounded-lg">
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* User Info (Auto-filled) */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Organizer Information
            </h3>
            <div className="p-4 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-lg">
              <p className="text-gray-900 dark:text-white">
                <span className="font-medium">Email:</span> {userEmail}
              </p>
              <p className="text-gray-600 dark:text-zinc-400 text-sm mt-1">
                This information is automatically filled from your account
              </p>
            </div>
          </div>

          {/* Event Details Section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Event Details
            </h3>
            <div className="space-y-4">
              {/* Event Name */}
              <div>
                <label className="block text-gray-900 dark:text-white font-medium mb-2">
                  Event Name *
                </label>
                <input
                  type="text"
                  name="event_name"
                  value={formData.event_name}
                  onChange={handleChange}
                  placeholder="e.g., Summer Music Festival"
                  className="w-full px-4 py-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-zinc-500 focus:outline-none focus:border-green-600 dark:focus:border-green-500 transition"
                  required
                />
              </div>

              {/* Event Description */}
              <div>
                <label className="block text-gray-900 dark:text-white font-medium mb-2">
                  Event Description
                </label>
                <textarea
                  name="event_description"
                  value={formData.event_description}
                  onChange={handleChange}
                  placeholder="Describe your event..."
                  rows={4}
                  className="w-full px-4 py-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-zinc-500 focus:outline-none focus:border-green-600 dark:focus:border-green-500 transition resize-none"
                />
              </div>
            </div>
          </div>

          {/* Schedule Section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Schedule</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Start Date */}
                <div>
                  <label className="block text-gray-900 dark:text-white font-medium mb-2">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    name="start_date"
                    value={formData.start_date}
                    onChange={handleChange}
                    className="w-full px-4 py-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-green-600 dark:focus:border-green-500 transition"
                    required
                  />
                </div>

                {/* Start Time */}
                <div>
                  <label className="block text-gray-900 dark:text-white font-medium mb-2">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    name="start_time"
                    value={formData.start_time}
                    onChange={handleChange}
                    className="w-full px-4 py-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-green-600 dark:focus:border-green-500 transition"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* End Date */}
                <div>
                  <label className="block text-gray-900 dark:text-white font-medium mb-2">
                    End Date *
                  </label>
                  <input
                    type="date"
                    name="end_date"
                    value={formData.end_date}
                    onChange={handleChange}
                    className="w-full px-4 py-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-green-600 dark:focus:border-green-500 transition"
                    required
                  />
                </div>

                {/* End Time */}
                <div>
                  <label className="block text-gray-900 dark:text-white font-medium mb-2">
                    End Time *
                  </label>
                  <input
                    type="time"
                    name="end_time"
                    value={formData.end_time}
                    onChange={handleChange}
                    className="w-full px-4 py-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-green-600 dark:focus:border-green-500 transition"
                    required
                  />
                </div>
              </div>

              {/* Timezone */}
              <div>
                <label className="block text-gray-900 dark:text-white font-medium mb-2">
                  Timezone
                </label>
                <select
                  name="timezone"
                  value={formData.timezone}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-green-600 dark:focus:border-green-500 transition"
                >
                  <option value="UTC">UTC</option>
                  <option value="EST">EST (UTC-5)</option>
                  <option value="CST">CST (UTC-6)</option>
                  <option value="MST">MST (UTC-7)</option>
                  <option value="PST">PST (UTC-8)</option>
                  <option value="IST">IST (UTC+5:30)</option>
                  <option value="GMT">GMT (UTC+0)</option>
                  <option value="CET">CET (UTC+1)</option>
                  <option value="AEST">AEST (UTC+10)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Media & Attachments Section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Event Banner Image
            </h3>
            <div className="space-y-4">
              {/* File Upload Area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-lg p-8 text-center cursor-pointer hover:border-green-400 dark:hover:border-green-600 hover:bg-gray-50 dark:hover:bg-zinc-800/30 transition"
              >
                <Upload size={32} className="mx-auto mb-2 text-gray-400 dark:text-zinc-400" />
                <p className="text-gray-900 dark:text-white font-medium mb-1">
                  Click to upload or drag and drop
                </p>
                <p className="text-gray-600 dark:text-zinc-400 text-sm">
                  PNG, JPG, GIF up to 5MB
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploadingImage}
                  className="hidden"
                />
              </div>

              {/* Image Preview */}
              {imagePreview && (
                <div className="relative">
                  <p className="text-gray-600 dark:text-zinc-400 text-sm mb-2">Preview:</p>
                  <div className="relative inline-block">
                    <Image
                      src={imagePreview}
                      alt="Event banner preview"
                      width={320}
                      height={128}
                      className="max-w-xs h-32 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImagePreview("");
                        setFormData((prev) => ({
                          ...prev,
                          event_banner_url: "",
                        }));
                      }}
                      className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 transition"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              )}

              {uploadingImage && (
                <div className="text-center">
                  <p className="text-gray-600 dark:text-zinc-400">Uploading image...</p>
                </div>
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex gap-4 pt-4 border-t border-gray-200 dark:border-zinc-700">
            <button
              type="submit"
              disabled={isLoading || uploadingImage}
              className="flex-1 py-2 bg-green-700 dark:bg-green-600 text-white rounded-lg font-medium hover:bg-green-800 dark:hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading
                ? "Saving..."
                : event
                  ? "Update Event"
                  : "Create Event"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-white rounded-lg font-medium hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
