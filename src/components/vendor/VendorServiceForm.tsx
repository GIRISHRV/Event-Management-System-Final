"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Image from "next/image";
import { ImageIcon, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { vendorServiceSchema, vendorCategoryEnum, type CreateVendorServiceInput, type VendorServiceRow } from "@/schemas/vendor.schema";
import { supabase } from "@/services/supabase/client";
import { vendorsService } from "@/services/vendors.service";
import { useToast } from "@/hooks/useToast";
import { STORAGE_BUCKETS } from "@/lib/constants";
import { Button } from "@/components/ui/button";

interface VendorServiceFormProps {
  onClose: () => void;
  onSuccess: () => void;
  initialData?: VendorServiceRow;
}

export default function VendorServiceForm({ onClose, onSuccess, initialData }: VendorServiceFormProps) {
  const { userProfile } = useAuth();
  const { error: toastError, success: toastSuccess } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createVendorServiceSchema = vendorServiceSchema.omit({
    id: true,
    created_at: true,
    updated_at: true
  }).extend({
    price_unit: z.enum(["per_hour", "per_event", "per_guest", "fixed"]),
    category: vendorCategoryEnum,
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<CreateVendorServiceInput>({
    resolver: zodResolver(createVendorServiceSchema),
    defaultValues: {
      vendor_id: userProfile?.id || "",
      service_name: initialData?.service_name || "",
      description: initialData?.description || "",
      base_price: initialData?.base_price || 0,
      price_unit: initialData?.price_unit || "fixed",
      category: initialData?.category || "other",
      images: initialData?.images || [],
    }
  });

  const images = watch("images") || [];

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toastError("File too large (max 5MB)");
      return;
    }

    try {
      setIsUploading(true);
      const fileName = `service_${Date.now()}_${file.name}`;
      const { data, error } = await supabase.storage.from(STORAGE_BUCKETS.EVENT_BANNERS).upload(fileName, file);

      if (error) throw error;

      const { data: publicData } = supabase.storage.from(STORAGE_BUCKETS.EVENT_BANNERS).getPublicUrl(data.path);

      setValue("images", [publicData.publicUrl]);
      toastSuccess("Cover image uploaded");
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const onSubmit = async (data: CreateVendorServiceInput) => {
    try {
      const response = initialData?.id
        ? await vendorsService.updateService(initialData.id, data)
        : await vendorsService.createService(data);

      if (!response.success) throw new Error(response.error?.message);

      toastSuccess(initialData ? "Service updated successfully." : "Service created successfully.");
      onSuccess();
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : "Failed to save service");
    }
  };

  // NOTE: This component is rendered inside a <Drawer> by vendor-dashboard/page.tsx.
  // Do NOT add another <Drawer> wrapper here.
  return (
    <div className="flex flex-col h-full min-h-0">

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8 custom-scrollbar">
        <form id="service-form" onSubmit={handleSubmit(onSubmit)} className="space-y-8">

          {/* 1. Service Details */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wider border-b border-[var(--color-border)] pb-2">
              1. Service Details
            </h3>
            <div className="grid gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--color-text-secondary)]">Service Name</label>
                <input
                  {...register("service_name")}
                  className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-4 py-2.5 text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-brand)] focus:border-transparent outline-none transition-all"
                  placeholder="e.g. Premium Wedding Photography (4K)"
                />
                {errors.service_name && <p className="text-xs text-[var(--color-danger)] font-medium mt-1">{errors.service_name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--color-text-secondary)]">Description</label>
                <textarea
                  {...register("description")}
                  className="w-full h-24 bg-[var(--color-background)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-4 py-3 text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-brand)] outline-none resize-none transition-all"
                  placeholder="Outline included materials, hours, and constraints..."
                />
                {errors.description && <p className="text-xs text-[var(--color-danger)] font-medium mt-1">{errors.description.message}</p>}
              </div>
            </div>
          </div>

          {/* 2. Pricing & Category */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wider border-b border-[var(--color-border)] pb-2">
              2. Pricing & Category
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--color-text-secondary)]">Category</label>
                <select
                  {...register("category")}
                  className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-4 py-2.5 text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-brand)] outline-none transition-all"
                >
                  {vendorCategoryEnum.options.map(cat => (
                    <option key={cat} value={cat} className="capitalize">{cat.replace("_", " ")}</option>
                  ))}
                </select>
                {errors.category && <p className="text-xs text-[var(--color-danger)] font-medium mt-1">{errors.category.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--color-text-secondary)]">Base Price</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] font-semibold">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    {...register("base_price", { valueAsNumber: true })}
                    className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-[var(--radius-md)] pl-8 pr-4 py-2.5 text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-brand)] outline-none transition-all"
                    placeholder="0.00"
                  />
                </div>
                {errors.base_price && <p className="text-xs text-[var(--color-danger)] font-medium mt-1">{errors.base_price.message}</p>}
              </div>
            </div>
          </div>

          {/* 3. Service Media */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wider border-b border-[var(--color-border)] pb-2">
              3. Service Media
            </h3>
            <div className="space-y-2">
              <div
                onClick={() => !isUploading && fileInputRef.current?.click()}
                className={`aspect-video w-full sm:w-2/3 mx-auto relative rounded-[var(--radius-lg)] border-2 border-dashed ${isUploading ? "border-[var(--color-brand)] bg-[var(--color-brand)]/5" : "border-[var(--color-border)] bg-[var(--color-background)] hover:border-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-hover)]"} transition-all cursor-pointer flex flex-col items-center justify-center gap-3 overflow-hidden group`}
              >
                {images.length > 0 ? (
                  <Image
                    src={images[0]}
                    alt="Service Preview"
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className={`object-cover ${isUploading ? "opacity-50" : "group-hover:scale-105 transition-transform duration-500"}`}
                  />
                ) : (
                  <>
                    <div className="p-3 rounded-full bg-[var(--color-surface)] text-[var(--color-text-tertiary)] shadow-sm group-hover:-translate-y-1 transition-transform">
                      <ImageIcon size={24} />
                    </div>
                    <span className="text-sm text-[var(--color-text-secondary)] font-medium">Upload Cover Image</span>
                  </>
                )}

                {isUploading && (
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center">
                    <div className="flex items-center gap-2 bg-[var(--color-surface)] px-4 py-2 rounded-full shadow-lg border border-[var(--color-border)]">
                      <Loader2 className="w-4 h-4 text-[var(--color-brand)] animate-spin" />
                      <span className="text-xs font-bold text-[var(--color-text-primary)] tracking-wider">UPLOADING...</span>
                    </div>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
                disabled={isUploading}
              />
              {errors.images && <p className="text-xs text-center text-[var(--color-danger)] font-medium mt-1">{errors.images.message}</p>}
            </div>
          </div>

        </form>
      </div>

      {/* Fixed footer */}
      <div className="shrink-0 px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-between">
        <Button variant="ghost" onClick={onClose} disabled={isSubmitting || isUploading}>
          Cancel
        </Button>
        <Button
          variant="primary"
          type="submit"
          form="service-form"
          disabled={isSubmitting || isUploading}
        >
          {isSubmitting ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
          ) : (
            initialData ? "Update Service" : "Create Service"
          )}
        </Button>
      </div>

    </div>
  );
}