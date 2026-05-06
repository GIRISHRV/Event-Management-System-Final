"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/services/supabase/client";
import { Mail, ArrowRight, Loader2, Sparkles, ChevronLeft, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/useToast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BackgroundEffects } from "@/components/ui/BackgroundEffects";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { success: toastSuccess, error: toastError } = useToast();

  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) {
        toastError(error.message || "Failed to send reset email. Please try again.");
        return;
      }

      setSubmitted(true);
      toastSuccess("Password reset email sent! Check your inbox.");
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : "An unexpected error occurred.");
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
        href="/signin"
        className="absolute top-8 left-8 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors group z-20"
      >
        <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
        Back to Sign In
      </Link>

      <main className="w-full max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
        {/* Logo/Header */}
        <div className="text-center mb-10">
          <div className="w-14 h-14 bg-[var(--color-brand)]/10 border border-[var(--color-brand)]/20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-500/10">
            <Sparkles size={28} className="text-[var(--color-brand)]" />
          </div>
          <h1 className="text-3xl font-black text-[var(--color-text-primary)] tracking-tight">
            Reset Password
          </h1>
          <p className="text-[var(--color-text-secondary)] mt-2 font-medium">
            Enter your email to receive a password reset link.
          </p>
        </div>

        <Card className="p-8 border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-xl shadow-2xl">
          {submitted ? (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} className="text-green-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
                  Check your email
                </h2>
                <p className="text-[var(--color-text-secondary)] text-sm">
                  We've sent a password reset link to <strong>{email}</strong>. Click the link in the email to proceed.
                </p>
              </div>
              <Button
                onClick={() => router.push("/signin")}
                className="w-full h-12 bg-[var(--color-brand)] hover:scale-[1.01] active:scale-[0.99] transition-all font-bold text-sm shadow-lg shadow-blue-500/20"
              >
                Return to Sign In
              </Button>
            </div>
          ) : (
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

              <Button
                type="submit"
                disabled={isLoading || !email}
                className="w-full h-12 bg-[var(--color-brand)] hover:scale-[1.01] active:scale-[0.99] transition-all font-bold text-sm shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin mr-2" size={18} />
                ) : (
                  <span className="flex items-center gap-2">
                    Send Reset Link <ArrowRight size={18} />
                  </span>
                )}
              </Button>
            </form>
          )}
        </Card>

        {/* Footer Links */}
        <p className="text-center text-xs text-[var(--color-text-tertiary)] mt-8">
          Don't have an account?{" "}
          <Link href="/signup" className="font-bold text-[var(--color-brand)] hover:underline">
            Sign Up
          </Link>
        </p>
      </main>
    </div>
  );
}
