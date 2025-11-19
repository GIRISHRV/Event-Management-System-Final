"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import PillNav from "@/components/PillNav";
import { useToast } from "@/components/Toast";

type Role = "customer" | "vendor";

export default function SignUpPage() {
  const router = useRouter();
  const { success: toastSuccess, Toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<Role>("customer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const navItems = [
    { label: 'Home', href: '/' },
    { label: 'Sign In', href: '/signin' },
    { label: 'Sign Up', href: '/signup' }
  ];

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      // Sign up user with metadata
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: email.split('@')[0], // Use email prefix as username
            full_name: email.split('@')[0], // Use email prefix as full name for now
            role: role
          }
        }
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data?.user) {
        // Update the profile with the role (trigger should have created the basic profile)
        const { error: profileError } = await supabase
          .from("profiles")
          .upsert({
            id: data.user.id,
            email: email,
            username: email.split('@')[0],
            full_name: email.split('@')[0],
            role: role,
            updated_at: new Date().toISOString(),
          });

        if (profileError) {
          // console.error("Profile update error:", profileError);
          // Don't fail the signup process for profile issues
        }

        // Don't login - just redirect to sign in page
        toastSuccess("Account created! Please check your email for verification, then sign in with your credentials.");
        setTimeout(() => {
          router.push("/signin");
        }, 2000);
      }
    } catch (err) {
      setError("An unexpected error occurred");
      // console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Navigation */}
      <PillNav
        items={navItems}
        activeHref="/signup"
        showAuth={false}
      />

      {/* Form Container */}
      <div className="flex items-center justify-center min-h-[calc(100vh-80px)] px-4 py-8 pt-24">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Create Account</h1>
            <p className="text-gray-400">Join EMS (WIP) today</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSignUp} className="space-y-4">
            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-gray-900 dark:text-white font-medium mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-zinc-500 focus:outline-none focus:border-green-700 dark:focus:border-green-500 transition"
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
              <p className="text-gray-600 dark:text-gray-400 text-xs mt-1">
                Must be at least 6 characters
              </p>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-gray-900 dark:text-white font-medium mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-zinc-500 focus:outline-none focus:border-green-700 dark:focus:border-green-500 transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-400"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Role Selection */}
            <div>
              <label className="block text-gray-900 dark:text-white font-medium mb-3">
                Account Type
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value="customer"
                    checked={role === "customer"}
                    onChange={(e) => setRole(e.target.value as Role)}
                    className="w-4 h-4"
                  />
                  <span className="text-gray-900 dark:text-white">Customer</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value="vendor"
                    checked={role === "vendor"}
                    onChange={(e) => setRole(e.target.value as Role)}
                    className="w-4 h-4"
                  />
                  <span className="text-gray-900 dark:text-white">Vendor</span>
                </label>
              </div>
            </div>

            {/* Terms Agreement */}
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" className="mt-1" required />
              <span className="text-gray-600 dark:text-gray-400 text-sm">
                I agree to the{" "}
                <a href="#" className="text-green-700 dark:text-green-500 hover:underline">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="#" className="text-green-700 dark:text-green-500 hover:underline">
                  Privacy Policy
                </a>
              </span>
            </label>

            {/* Sign Up Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-green-700 dark:bg-green-600 text-white rounded-lg font-medium hover:bg-green-800 dark:hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating Account..." : "Sign Up"}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-300 dark:bg-zinc-700"></div>
            <span className="text-gray-500 dark:text-zinc-500 text-sm">or</span>
            <div className="flex-1 h-px bg-gray-300 dark:bg-zinc-700"></div>
          </div>

          {/* Sign In Link */}
          <p className="text-center text-gray-600 dark:text-gray-400">
            Already have an account?{" "}
            <Link href="/signin" className="text-green-700 dark:text-green-500 hover:underline font-medium">
              Sign In
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
      <Toast />
    </div>
  );
}
