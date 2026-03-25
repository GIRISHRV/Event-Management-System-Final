"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/services/supabase/client";
import {
  User, Store, Mail, Lock,
  ArrowRight, Loader2, Sparkles,
  ChevronLeft, CheckCircle2
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signUpSchema, type SignUpFormData } from "@/schemas/auth.schema";
import { useToast } from "@/hooks/useToast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BackgroundEffects } from "@/components/ui/BackgroundEffects";
import { cn } from "@/lib/cn";

// Map raw Supabase error messages to friendly user-facing copy
function getFriendlyError(message: string): string {
  if (message.includes("already registered") || message.includes("duplicate key") || message.includes("already exists")) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (message.includes("password")) {
    return "Password does not meet the requirements. Please choose a stronger password.";
  }
  if (message.includes("rate limit") || message.includes("too many")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  return "Registration failed. Please check your details and try again.";
}

export default function SignUpPage() {
  const router = useRouter();
  const { error: toastError } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: "", password: "", confirmPassword: "", role: "customer" },
  });

  const selectedRole = watch("role");

  const onSubmit = async (data: SignUpFormData) => {
    setIsLoading(true);
    try {
      // 1. Create the auth user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            username: data.email.split("@")[0],
            full_name: data.email.split("@")[0],
            role: data.role,
          },
        },
      });

      if (signUpError) throw signUpError;

      if (!authData?.user) {
        throw new Error("Account creation failed. Please try again.");
      }

      // 2. Create the profile row — check the result
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: authData.user.id,
        email: data.email,
        username: data.email.split("@")[0],
        full_name: data.email.split("@")[0],
        role: data.role,
        updated_at: new Date().toISOString(),
      });

      if (profileError) {
        // Auth user was created but profile failed — log it and continue.
        // The profile can be recreated on first sign-in via AuthContext.
        console.error("[SignUp] Profile upsert failed:", profileError.message);
      }

      // 3. Redirect to verify-email page — NOT to /signin
      // User cannot sign in until they verify their email.
      router.replace(`/verify-email?email=${encodeURIComponent(data.email)}`);

    } catch (err: unknown) {
      toastError(getFriendlyError(err instanceof Error ? err.message : ""));
    } finally {
      setIsLoading(false);
    }
  };

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

      <main className="w-full max-w-2xl relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">

        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-[var(--color-brand)]/10 border border-[var(--color-brand)]/20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-blue-500/5">
            <Sparkles size={24} className="text-[var(--color-brand)]" />
          </div>
          <h1 className="text-3xl font-black text-[var(--color-text-primary)] tracking-tight">
            Join Event MS
          </h1>
          <p className="text-[var(--color-text-secondary)] mt-1 font-medium">
            The professional network for world-class events.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

          {/* Role Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setValue("role", "customer", { shouldValidate: true })}
              className={cn(
                "relative p-6 rounded-2xl border-2 text-left transition-all duration-300 group",
                selectedRole === "customer"
                  ? "bg-[var(--color-brand)]/5 border-[var(--color-brand)] shadow-2xl shadow-blue-500/10"
                  : "bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-text-tertiary)]"
              )}
            >
              <div className={cn(
                "w-12 h-12 rounded-2xl mb-4 flex items-center justify-center transition-all",
                selectedRole === "customer" ? "bg-[var(--color-brand)] text-white scale-110" : "bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)]"
              )}>
                <User size={24} />
              </div>
              <h3 className="font-bold text-[var(--color-text-primary)] text-lg">Organizer</h3>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1 leading-relaxed">I want to plan events and find talent.</p>
              {selectedRole === "customer" && <CheckCircle2 className="absolute top-6 right-6 text-[var(--color-brand)]" size={20} />}
            </button>

            <button
              type="button"
              onClick={() => setValue("role", "vendor", { shouldValidate: true })}
              className={cn(
                "relative p-6 rounded-2xl border-2 text-left transition-all duration-300 group",
                selectedRole === "vendor"
                  ? "bg-[var(--color-brand)]/5 border-[var(--color-brand)] shadow-2xl shadow-blue-500/10"
                  : "bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-text-tertiary)]"
              )}
            >
              <div className={cn(
                "w-12 h-12 rounded-2xl mb-4 flex items-center justify-center transition-all",
                selectedRole === "vendor" ? "bg-[var(--color-brand)] text-white scale-110" : "bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)]"
              )}>
                <Store size={24} />
              </div>
              <h3 className="font-bold text-[var(--color-text-primary)] text-lg">Vendor</h3>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1 leading-relaxed">I want to offer services and grow.</p>
              {selectedRole === "vendor" && <CheckCircle2 className="absolute top-6 right-6 text-[var(--color-brand)]" size={20} />}
            </button>
          </div>

          <Card className="p-8 md:p-10 border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-2xl shadow-2xl space-y-6">
            <div className="grid grid-cols-1 gap-5">
              <div className="space-y-1">
                <Input
                  type="email"
                  {...register("email")}
                  leftIcon={<Mail size={18} />}
                  placeholder="name@example.com"
                  label="Email Address"
                  className="bg-[var(--color-surface-hover)] border-[var(--color-border)] h-12 rounded-xl"
                />
                {errors.email && <p className="text-xs font-medium text-red-400 px-1">{errors.email.message}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1">
                  <Input
                    type="password"
                    {...register("password")}
                    leftIcon={<Lock size={18} />}
                    placeholder="••••••••"
                    label="Password"
                    className="bg-[var(--color-surface-hover)] border-[var(--color-border)] h-12 rounded-xl"
                  />
                  {errors.password && <p className="text-xs font-medium text-red-400 px-1">{errors.password.message}</p>}
                </div>

                <div className="space-y-1">
                  <Input
                    type="password"
                    {...register("confirmPassword")}
                    leftIcon={<Lock size={18} />}
                    placeholder="••••••••"
                    label="Confirm Password"
                    className="bg-[var(--color-surface-hover)] border-[var(--color-border)] h-12 rounded-xl"
                  />
                  {errors.confirmPassword && <p className="text-xs font-medium text-red-400 px-1">{errors.confirmPassword.message}</p>}
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-14 bg-[var(--color-brand)] hover:brightness-110 transition-all font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-500/20"
            >
              {isLoading ? (
                <Loader2 className="animate-spin mr-2" size={20} />
              ) : (
                <span className="flex items-center gap-2">
                  Create My Account <ArrowRight size={20} />
                </span>
              )}
            </Button>

            <div className="pt-4 text-center">
              <p className="text-sm text-[var(--color-text-tertiary)] font-medium">
                Already part of the network?{" "}
                <Link href="/signin" className="text-[var(--color-brand)] font-bold hover:underline">
                  Sign In
                </Link>
              </p>
            </div>
          </Card>
        </form>
      </main>
    </div>
  );
}
