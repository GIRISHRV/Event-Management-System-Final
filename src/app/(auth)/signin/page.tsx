"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, ArrowRight, Loader2, Sparkles, ChevronLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/useToast";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { BackgroundEffects } from "@/components/ui/BackgroundEffects";

export default function SignInPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await signIn(email, password);
      toastSuccess("Welcome back to Event MS!");
      router.push("/");
    } catch (err: unknown) {
      // ✅ err: unknown — type-narrowed before access, no implicit any
      toastError(err instanceof Error ? err.message : "Invalid credentials. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const inputClasses = "w-full bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-xl px-11 py-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/50 focus:border-[var(--color-brand)] transition-all";

  return (
    <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center p-6 relative overflow-hidden">
      <BackgroundEffects variant="gradient" className="opacity-40" />

      {/* Back Link */}
      <Link
        href="/"
        className="absolute top-8 left-8 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors group z-20"
      >
        <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
        Return Home
      </Link>

      <main className="w-full max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">

        {/* Logo/Header */}
        <div className="text-center mb-10">
          <div className="w-14 h-14 bg-[var(--color-brand)]/10 border border-[var(--color-brand)]/20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-500/10">
            <Sparkles size={28} className="text-[var(--color-brand)]" />
          </div>
          <h1 className="text-3xl font-black text-[var(--color-text-primary)] tracking-tight">
            Sign In
          </h1>
          <p className="text-[var(--color-text-secondary)] mt-2 font-medium">
            Continue your event journey.
          </p>
        </div>

        <Card className="p-8 border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-xl shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Email Field */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] ml-1">
                Email Address
              </label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] group-focus-within:text-[var(--color-brand)] transition-colors" size={18} />
                <input
                  type="email"
                  placeholder="name@example.com"
                  className={inputClasses}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex justify-between items-end px-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  Password
                </label>
                <Link href="/forgot-password" className="text-xs font-bold text-[var(--color-brand)] hover:underline">
                  Forgot?
                </Link>
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] group-focus-within:text-[var(--color-brand)] transition-colors" size={18} />
                <input
                  type="password"
                  placeholder="••••••••"
                  className={inputClasses}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-[var(--color-brand)] hover:scale-[1.01] active:scale-[0.99] transition-all font-bold text-sm shadow-lg shadow-blue-500/20"
            >
              {isLoading ? (
                <Loader2 className="animate-spin mr-2" size={18} />
              ) : (
                <span className="flex items-center gap-2">
                  Sign In <ArrowRight size={18} />
                </span>
              )}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-[var(--color-border)] text-center">
            <p className="text-sm text-[var(--color-text-tertiary)]">
              New to Event MS?{" "}
              <Link href="/signup" className="text-[var(--color-brand)] font-bold hover:underline">
                Create an account
              </Link>
            </p>
          </div>
        </Card>

        {/* Legal Footer */}
        <p className="mt-8 text-center text-[10px] text-[var(--color-text-tertiary)] uppercase tracking-[0.15em] leading-relaxed px-10">
          By signing in, you agree to our <br />
          <a href="/terms" className="text-[var(--color-text-secondary)] hover:text-[var(--color-brand)] underline">Terms of Service</a> &amp; <a href="/privacy" className="text-[var(--color-text-secondary)] hover:text-[var(--color-brand)] underline">Privacy Policy</a>.
        </p>
      </main>
    </div>
  );
}