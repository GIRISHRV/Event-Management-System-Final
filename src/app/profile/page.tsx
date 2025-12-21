"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import PillNav from "@/components/layout/PillNav";
import { useToast } from "@/components/ui/Toast";
import { Loader2, Upload, User, Save, ArrowLeft, Mail, Shield, Hash, Briefcase } from "lucide-react";
import Squares from "@/components/ui/Squares";
import { LoadingScreen } from "@/components/ui/LoadingScreen";

export default function ProfilePage() {
  const router = useRouter();
  const { session, userProfile, loading: authLoading } = useAuth();
  const { success, error: toastError, Toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    username: "",
    bio: "",
    avatar_url: "",
  });

  useEffect(() => {
    if (userProfile) {
      setFormData({
        full_name: userProfile.full_name || "",
        username: userProfile.username || "",
        bio: userProfile.bio || "",
        avatar_url: userProfile.avatar_url || "",
      });
    }
  }, [userProfile]);

  // Protect route
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

      const fileExt = file.name.split('.').pop();
      const fileName = `${session?.user.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, avatar_url: publicUrl }));
      success("Avatar uploaded successfully!");
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toastError("Failed to upload avatar");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          username: formData.username,
          bio: formData.bio,
          avatar_url: formData.avatar_url,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.user.id);

      if (error) throw error;
      success("Profile updated successfully!");
      router.refresh();
    } catch (error) {
      console.error('Error updating profile:', error);
      toastError("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const navItems = [
    { label: 'Home', href: '/' },
    { label: 'Events', href: '/events' },
    { label: 'Dashboard', href: userProfile?.role === 'vendor' ? '/vendor-dashboard' : '/customer-dashboard' },
    { label: 'Profile', href: '/profile' }
  ];

  const isVendor = userProfile?.role === 'vendor';

  return (
    <div className="min-h-screen bg-zinc-950 relative overflow-hidden">
      <LoadingScreen message="Loading profile..." isLoading={authLoading || !session} />
      
      {/* Animated Background */}
      <div className="fixed inset-0 z-0">
        <Squares
          direction="diagonal"
          speed={0.5}
          borderColor={isVendor ? "rgba(99, 102, 241, 0.2)" : "rgba(34, 197, 94, 0.2)"}
          squareSize={50}
          hoverFillColor={isVendor ? "rgba(99, 102, 241, 0.1)" : "rgba(34, 197, 94, 0.1)"}
        />
      </div>

      {session && (
        <>
          <PillNav
            items={navItems}
            activeHref="/profile"
            userEmail={session?.user?.email}
            onSignOut={handleSignOut}
            showAuth={true}
          />

          <div className="relative z-20 max-w-7xl mx-auto px-6 py-12 pt-24">
            <div className="mb-8">
              <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
              >
                <ArrowLeft size={20} />
                Back
              </button>
              <h1 className="text-3xl font-bold text-white">Edit Profile</h1>
              <p className="text-gray-400">Customize your public profile</p>
            </div>

            {/* Side by Side Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Side - Edit Form */}
              <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800 rounded-2xl p-8 shadow-xl">
                <form onSubmit={handleSubmit} className="space-y-8">
                  {/* Avatar Section */}
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative group">
                      <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-zinc-800 bg-zinc-800 relative">
                        {formData.avatar_url ? (
                          <Image
                            src={formData.avatar_url}
                            alt="Profile"
                            fill
                            className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-600">
                          <User size={48} />
                        </div>
                      )}
                      
                      {/* Overlay */}
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        <Upload className="text-white" size={24} />
                      </div>
                    </div>
                    {uploading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                        <Loader2 className={`w-8 h-8 animate-spin ${isVendor ? 'text-indigo-500' : 'text-green-500'}`} />
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={`text-sm font-medium ${isVendor ? 'text-indigo-500 hover:text-indigo-400' : 'text-green-500 hover:text-green-400'}`}
                    >
                      Change Avatar
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                    <p className="text-xs text-gray-500 mt-1">Recommended: Square image, max 2MB</p>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={formData.full_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                        className={`w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-1 transition-all ${
                          isVendor ? 'focus:border-indigo-500 focus:ring-indigo-500' : 'focus:border-green-500 focus:ring-green-500'
                        }`}
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Username
                      </label>
                      <input
                        type="text"
                        value={formData.username}
                        onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                        className={`w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-1 transition-all ${
                          isVendor ? 'focus:border-indigo-500 focus:ring-indigo-500' : 'focus:border-green-500 focus:ring-green-500'
                        }`}
                        placeholder="@johndoe"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Bio
                    </label>
                    <textarea
                      value={formData.bio}
                      onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                      rows={4}
                      className={`w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-1 transition-all resize-none ${
                        isVendor ? 'focus:border-indigo-500 focus:ring-indigo-500' : 'focus:border-green-500 focus:ring-green-500'
                      }`}
                      placeholder="Tell us a bit about yourself..."
                    />
                    <p className="text-xs text-gray-500 mt-2 text-right">
                      {formData.bio.length}/500 characters
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={session.user.email}
                      disabled
                      className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-gray-400 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-500 mt-2">Email cannot be changed</p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-4 pt-4 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => router.back()}
                    className="px-6 py-2.5 text-gray-400 hover:text-white font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className={`flex items-center gap-2 px-8 py-2.5 text-white rounded-xl font-medium transition-all shadow-lg ${
                      isVendor 
                        ? 'bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-600/50 shadow-indigo-900/20' 
                        : 'bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 shadow-green-900/20'
                    }`}
                  >
                    {loading ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={18} />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
                </form>
              </div>

              {/* Right Side - Account Info & Stats */}
              <div className="space-y-6">
                {/* Account Information Section */}
                <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800 rounded-2xl p-6 shadow-xl">
                  <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                    <Shield size={20} className="text-zinc-400" />
                    Account Information
                  </h2>
              
                  <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-zinc-800/50 rounded-xl">
                  <Mail size={18} className="text-zinc-400" />
                  <div>
                    <p className="text-sm text-zinc-400">Email Address</p>
                    <p className="text-white font-medium">{session.user.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-zinc-800/50 rounded-xl">
                  <Shield size={18} className="text-zinc-400" />
                  <div>
                    <p className="text-sm text-zinc-400">Account Type</p>
                    <p className="text-white font-medium capitalize">{userProfile?.role || "Customer"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-zinc-800/50 rounded-xl">
                  <Hash size={18} className="text-zinc-400" />
                  <div>
                    <p className="text-sm text-zinc-400">User ID</p>
                    <code className="text-xs bg-black/50 px-2 py-1 rounded text-gray-400">
                      {session.user.id}
                    </code>
                  </div>
                </div>
              </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      <Toast />
    </div>
  );
}
