"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import PillNav from "@/components/PillNav";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      if (data?.session?.user) {
        // Fetch user role to determine which dashboard to redirect to
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role, email")
          .eq("id", data.session.user.id)
          .single();

        if (profileError) {
          console.error("Error fetching profile:", profileError);
          
          // If profile doesn't exist, create it with default role
          if (profileError.code === 'PGRST116') {
            console.log("Profile not found, creating default profile...");
            const { error: createError } = await supabase
              .from("profiles")
              .insert({
                id: data.session.user.id,
                email: data.session.user.email || email,
                role: 'customer',
                created_at: new Date().toISOString(),
              });

            if (createError) {
              console.error("Error creating profile:", createError);
              setError("Could not create user profile");
              return;
            }
            
            // Default to customer dashboard for new profiles
            router.push("/customer-dashboard");
            return;
          } else {
            setError("Could not determine user role");
            return;
          }
        }

        // Redirect based on role - auth context will handle the session update
        const role = profile?.role;
        if (role === "vendor") {
          router.push("/vendor-dashboard");
        } else {
          // Default to customer dashboard for any non-vendor users
          router.push("/customer-dashboard");
        }
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const navItems = [
    { label: 'Home', href: '/' },
    { label: 'Sign In', href: '/signin' },
    { label: 'Sign Up', href: '/signup' }
  ];

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Navigation */}
      <PillNav
        items={navItems}
        activeHref="/signin"
        showAuth={false}
      />
      <div className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <Link href="/" className="text-2xl font-bold text-green-700 dark:text-green-500 hover:text-green-800 dark:hover:text-green-400 transition">
          EMS (WIP)
        </Link>
        <ThemeToggle />
      </div>

      {/* Form Container */}
      <div className="flex items-center justify-center min-h-[calc(100vh-80px)] px-4">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
            <p className="text-gray-400">Sign in to your account</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSignIn} className="space-y-4">
            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-500/10 dark:bg-red-900/20 border border-red-500/50 dark:border-red-500/30 rounded-lg">
                <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-white font-medium mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-green-500 transition"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-gray-900 dark:text-white font-medium mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-zinc-500 focus:outline-none focus:border-green-700 dark:focus:border-green-500 transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-400"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-green-700 dark:bg-green-600 text-white rounded-lg font-medium hover:bg-green-800 dark:hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-300 dark:bg-zinc-700"></div>
            <span className="text-gray-500 dark:text-zinc-500 text-sm">or</span>
            <div className="flex-1 h-px bg-gray-300 dark:bg-zinc-700"></div>
          </div>

          {/* Sign Up Link */}
          <p className="text-center text-gray-600 dark:text-gray-400">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-green-700 dark:text-green-500 hover:underline font-medium">
              Sign Up
            </Link>
          </p>

          {/* Back to Home */}
          <div className="mt-8 text-center">
            <Link href="/" className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm transition">
              <ArrowLeft size={16} /> Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
