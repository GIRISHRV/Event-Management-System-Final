"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/services/supabase/client";
import { STORAGE_BUCKETS } from "@/lib/constants";
import { useToast } from "@/hooks/useToast";
import { Loader2, User, Save, Mail, Hash, Camera } from "lucide-react";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { profileUpdateSchema, type ProfileUpdateFormData } from "@/schemas/profile.schema";
import { cn } from "@/lib/cn";

export default function ProfilePage() {
  const router = useRouter();
  const { session, userProfile, loading: authLoading } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileUpdateFormData>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: { full_name: "", username: "", bio: "", avatar_url: "" },
  });

  const avatarUrl = watch("avatar_url");

  // Sync user profile data to form
  useEffect(() => {
    if (userProfile) {
      reset({
        full_name: userProfile.full_name || "",
        username: userProfile.username || "",
        bio: userProfile.bio || "",
        avatar_url: userProfile.avatar_url || "",
      });
    }
  }, [userProfile, reset]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !session) {
      router.push("/signin");
    }
  }, [session, authLoading, router]);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      const file = event.target.files?.[0];
      if (!file) return;

      if (file.size > 2 * 1024 * 1024) throw new Error("File size too large (max 2MB)");

      const fileExt = file.name.split(".").pop();
      const fileName = `${session?.user.id}-${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKETS.AVATARS).upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from(STORAGE_BUCKETS.AVATARS).getPublicUrl(fileName);

      setValue("avatar_url", publicUrl, { shouldValidate: true, shouldDirty: true });
      toastSuccess("Profile picture uploaded successfully!");
    } catch (error: unknown) {
      // ✅ err: unknown — type-narrowed before access
      toastError(error instanceof Error ? error.message : "Image upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (data: ProfileUpdateFormData) => {
    if (!session?.user) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: data.full_name,
          username: data.username,
          bio: data.bio,
          avatar_url: data.avatar_url,
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.user.id);

      if (error) throw error;
      toastSuccess("Profile updated successfully.");
      router.refresh();
    } catch (err: unknown) {
      // ✅ err: unknown — type-narrowed before access
      console.error("[Profile Update] Error:", err);
      toastError(err instanceof Error ? err.message : "Failed to update profile.");
    }
  };

  if (authLoading || !session) {
    return <LoadingScreen message="Loading profile..." isLoading={true} />;
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] flex flex-col relative overflow-hidden">
      <Navbar />

      <main className="flex-1 relative z-20 max-w-6xl w-full mx-auto px-4 py-8 mt-16">

        {/* Header Grid */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-[var(--color-text-primary)] mb-1 tracking-tight">Profile Settings</h1>
            <p className="text-[var(--color-text-tertiary)] text-sm font-medium">Manage your personal information and account details.</p>
          </div>
          <div className="flex gap-2">
            <span className={cn(
              "px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-bold uppercase tracking-wider border",
              userProfile?.role === "vendor"
                ? "bg-[var(--color-warning)]/10 border-[var(--color-warning)]/30 text-[var(--color-warning)]"
                : "bg-[var(--color-brand)]/10 border-[var(--color-brand)]/30 text-[var(--color-brand)]"
            )}>
              {userProfile?.role || "User"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Identity HUD Left Column */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-6 flex flex-col items-center text-center relative overflow-hidden shadow-sm hover:shadow-md transition-shadow">

              <div className="relative mb-4 mt-2 group">
                <div className="w-24 h-24 rounded-[var(--radius-full)] overflow-hidden border-2 border-[var(--color-border-hover)] relative bg-[var(--color-surface-hover)]">
                  {avatarUrl ? (
                    <Image src={avatarUrl} alt="Profile" fill sizes="96px" className="object-cover" unoptimized />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[var(--color-text-tertiary)]">
                      <User size={36} />
                    </div>
                  )}

                  {uploading && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20 backdrop-blur-sm">
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    </div>
                  )}

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10 backdrop-blur-sm"
                  >
                    <Camera className="text-white" size={24} />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 p-2 bg-[var(--color-brand)] text-white rounded-[var(--radius-full)] hover:brightness-110 transition-colors z-20 shadow-md transform translate-x-1/4 translate-y-1/4"
                >
                  <Camera size={14} />
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              </div>

              <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-1 leading-tight">{watch("full_name") || "No Name Set"}</h2>
              <p className="text-[var(--color-text-tertiary)] text-xs font-mono mb-6 bg-[var(--color-surface-hover)] px-2 py-0.5 rounded-[var(--radius-sm)]">@{watch("username") || "none"}</p>

              <div className="w-full grid grid-cols-2 gap-3 border-t border-[var(--color-border)] pt-4">
                <div className="text-center p-3 rounded-[var(--radius-md)] bg-[var(--color-surface-hover)]">
                  <span className="block text-xs text-[var(--color-text-tertiary)] uppercase tracking-wider font-bold mb-1">Member Since</span>
                  <span className="text-[var(--color-text-primary)] text-sm font-semibold">
                    {userProfile?.created_at ? new Date(userProfile.created_at).getFullYear() : "N/A"}
                  </span>
                </div>
                <div className="text-center p-3 rounded-[var(--radius-md)] bg-[var(--color-surface-hover)]">
                  <span className="block text-xs text-[var(--color-text-tertiary)] uppercase tracking-wider font-bold mb-1">Status</span>
                  <span className="text-[var(--color-success)] text-sm font-bold flex items-center justify-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] animate-pulse" /> Active
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-5 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-4 border-b border-[var(--color-border)] pb-2">Account Details</h3>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-[var(--radius-md)] bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)] shadow-inner">
                  <Mail size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-[var(--color-text-tertiary)] font-semibold">Email Address</p>
                  <p className="text-sm text-[var(--color-text-primary)] truncate font-medium">{session.user.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 rounded-[var(--radius-md)] bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)] shadow-inner">
                  <Hash size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-[var(--color-text-tertiary)] font-semibold">External ID</p>
                  <p className="text-xs text-[var(--color-text-secondary)] font-mono truncate">{session.user.id}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Profile Settings */}
          <div className="lg:col-span-8">
            <form onSubmit={handleSubmit(onSubmit)} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-6 relative overflow-hidden shadow-sm h-full flex flex-col">

              <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-6 border-b border-[var(--color-border)] pb-3">Edit Profile</h3>

              <div className="space-y-6 flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wide">Full Name</label>
                    <Input
                      type="text"
                      {...register("full_name")}
                      className="bg-[var(--color-background)] border-[var(--color-border)] shadow-inner"
                      placeholder="Enter your full name"
                    />
                    {errors.full_name && <p className="text-xs text-[var(--color-error)] font-medium">{errors.full_name.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wide">Username</label>
                    <div className="relative flex items-center">
                      <span className="absolute left-4 text-[var(--color-text-tertiary)] font-mono text-sm pointer-events-none">@</span>
                      <Input
                        type="text"
                        {...register("username")}
                        className="bg-[var(--color-background)] border-[var(--color-border)] pl-8 shadow-inner"
                        placeholder="Choose a username"
                      />
                    </div>
                    {errors.username && <p className="text-xs text-[var(--color-error)] font-medium">{errors.username.message}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wide">About You</label>
                  <Textarea
                    {...register("bio")}
                    className="h-32 bg-[var(--color-background)] border-[var(--color-border)] resize-none shadow-inner"
                    placeholder="Share a short bio with the community..."
                    maxLength={500}
                  />
                  <div className="flex justify-between items-center text-xs font-medium">
                    {errors.bio ? (
                      <span className="text-[var(--color-error)]">{errors.bio.message}</span>
                    ) : <span />}
                    <span className="text-[var(--color-text-tertiary)]">{watch("bio")?.length || 0}/500 characters</span>
                  </div>
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-[var(--color-border)] flex items-center justify-end gap-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => reset()}
                  disabled={isSubmitting}
                  className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
                >
                  Cancel Changes
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-w-[140px] bg-[var(--color-brand)] hover:brightness-110 text-white font-bold shadow-md"
                >
                  {isSubmitting ? (
                    <Loader2 className="animate-spin mr-2" size={16} />
                  ) : (
                    <Save className="mr-2" size={16} />
                  )}
                  Save Changes
                </Button>
              </div>

            </form>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}