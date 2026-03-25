"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/services/supabase/client";
import { Mail, ArrowRight, Loader2, CheckCircle2, ChevronLeft } from "lucide-react";
import { BackgroundEffects } from "@/components/ui/BackgroundEffects";
import { Button } from "@/components/ui/button";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState("");

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    setError("");
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email,
      });
      if (resendError) throw resendError;
      setResent(true);
    } catch {
      setError("Could not resend email. Please try again shortly.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center p-6 relative overflow-hidden">
      <BackgroundEffects variant="gradient" className="opacity-40" />

      <Link
        href="/"
        className="absolute top-8 left-8 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors group z-20"
      >
        <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
        Return Home
      </Link>

      <main className="w-full max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700 text-center">

        {/* Icon */}
        <div className="w-16 h-16 bg-[var(--color-brand)]/10 border border-[var(--color-brand)]/20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-500/5">
          <Mail size={28} className="text-[var(--color-brand)]" />
        </div>

        <h1 className="text-3xl font-black text-[var(--color-text-primary)] tracking-tight mb-3">
          Check your email
        </h1>

        <p className="text-[var(--color-text-secondary)] leading-relaxed mb-2">
          We sent a verification link to
        </p>
        {email && (
          <p className="text-[var(--color-text-primary)] font-bold mb-6 break-all">
            {email}
          </p>
        )}
        <p className="text-sm text-[var(--color-text-tertiary)] mb-10 max-w-xs mx-auto leading-relaxed">
          Click the link in the email to activate your account. It may take a minute or two to arrive.
        </p>

        {/* Resend */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 space-y-4">
          {resent ? (
            <div className="flex items-center justify-center gap-2 text-[var(--color-success)] text-sm font-semibold">
              <CheckCircle2 size={18} />
              Email resent successfully
            </div>
          ) : (
            <>
              <p className="text-sm text-[var(--color-text-tertiary)]">
                Didn&apos;t receive it? Check your spam folder or resend.
              </p>
              {error && (
                <p className="text-xs text-[var(--color-danger)]">{error}</p>
              )}
              <Button
                onClick={handleResend}
                disabled={resending || !email}
                variant="secondary"
                className="w-full"
              >
                {resending ? (
                  <Loader2 className="animate-spin mr-2" size={16} />
                ) : null}
                Resend verification email
              </Button>
            </>
          )}

          <div className="pt-2 border-t border-[var(--color-border)]">
            <p className="text-sm text-[var(--color-text-tertiary)]">
              Already verified?{" "}
              <Link href="/signin" className="text-[var(--color-brand)] font-bold hover:underline inline-flex items-center gap-1">
                Sign in <ArrowRight size={14} />
              </Link>
            </p>
          </div>
        </div>

      </main>
    </div>
  );
}
