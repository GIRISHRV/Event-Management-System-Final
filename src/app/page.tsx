"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Calendar, Sparkles, Shield, Zap, CheckCircle2, Globe } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { usePublicEvents, useMyEvents } from "@/hooks/useEvents";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { BackgroundEffects } from "@/components/ui/BackgroundEffects";
import { EventList } from "@/components/events/EventList";
import { EventRecommendations } from "@/components/events/EventRecommendations";
import { Button } from "@/components/ui/Button";
import type { Event } from "@/lib/supabase-types";

export default function Home() {
  const router = useRouter();
  const { session, userProfile } = useAuth();
  const userId = session?.user?.id;

  const { events, isLoading } = usePublicEvents({ page: 1, limit: 8 });
  const { events: bookedEvents } = useMyEvents(userId, { page: 1, limit: 50 });

  const handleGoToDashboard = () => {
    if (userProfile?.role === "admin") router.push("/admin-dashboard");
    else if (userProfile?.role === "customer") router.push("/customer-dashboard");
    else if (userProfile?.role === "vendor") router.push("/vendor-dashboard");
  };

  return (
    <div className="min-h-screen bg-[var(--color-background)] flex flex-col relative overflow-x-hidden">
      <BackgroundEffects variant="gradient" className="opacity-30" />
      <Navbar />

      <main className="flex-1 relative z-10 w-full pt-20">

        {/* --- HERO SECTION --- */}
        <section className="relative px-6 pt-20 pb-32 lg:pt-32 lg:pb-40 overflow-hidden">
          <div className="max-w-7xl mx-auto flex flex-col items-center text-center">

            {/* Tagline Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-brand)]/10 border border-[var(--color-brand)]/20 text-[var(--color-brand)] mb-10 text-[11px] font-black uppercase tracking-[0.2em] animate-in fade-in slide-in-from-bottom-4 duration-700">
              <Sparkles size={14} /> The Next-Gen Event Protocol
            </div>

            <h1 className="text-5xl md:text-8xl font-black text-[var(--color-text-primary)] mb-8 tracking-tight leading-[0.95] max-w-5xl animate-in fade-in slide-in-from-bottom-8 duration-1000">
              Your vision, <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-brand)] via-purple-500 to-indigo-500">
                Perfectly executed.
              </span>
            </h1>

            <p className="text-lg md:text-xl text-[var(--color-text-secondary)] mb-12 max-w-2xl mx-auto leading-relaxed opacity-80 animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-200">
              The professional ecosystem for creating, managing, and discovering events. Connect with top-tier vendors and streamline your guest management.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center w-full sm:w-auto animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300">
              {session ? (
                <Button
                  onClick={handleGoToDashboard}
                  size="lg"
                  className="h-14 px-10 text-lg font-bold bg-[var(--color-brand)] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-blue-500/20 gap-3"
                >
                  <Shield size={20} /> Access Your Dashboard
                </Button>
              ) : (
                <>
                  <Link href="/events" className="w-full sm:w-auto">
                    <Button
                      size="lg"
                      className="w-full h-14 px-10 text-lg font-bold bg-[var(--color-brand)] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-blue-500/20 gap-3"
                    >
                      Start Exploring <ArrowRight size={20} />
                    </Button>
                  </Link>
                  <Link href="/signin" className="w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="lg"
                      className="w-full h-14 px-10 text-lg font-bold border-[var(--color-border)] hover:bg-[var(--color-surface)]"
                    >
                      Sign In
                    </Button>
                  </Link>
                </>
              )}
            </div>

            {/* Platform Stats Row */}
            <div className="mt-20 flex flex-wrap justify-center gap-x-12 gap-y-6 text-[var(--color-text-tertiary)] opacity-60 animate-in fade-in duration-1000 delay-500">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                <CheckCircle2 size={16} className="text-[var(--color-brand)]" />
                Secure Payments
              </div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                <Globe size={16} className="text-[var(--color-brand)]" />
                Local Discoverability
              </div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                <Zap size={16} className="text-[var(--color-brand)]" />
                Instant RSVP
              </div>
            </div>
          </div>
        </section>

        {/* Personalized Recommendations for Logged-in Users */}
        {session && userId && (
          <section className="max-w-7xl mx-auto px-6 pt-24 -mb-12 relative z-10">
            <EventRecommendations userId={userId} bookedEvents={(bookedEvents ?? []) as Event[]} />
          </section>
        )}

        {/* --- FEATURED EVENTS SECTION --- */}
        <section className="relative max-w-7xl mx-auto px-6 py-24 border-t border-[var(--color-border)]/50">
          <div className="flex flex-col md:flex-row items-end justify-between mb-16 gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                  <Zap size={24} />
                </div>
                <h2 className="text-3xl font-black text-[var(--color-text-primary)] tracking-tight">
                  Happening Now
                </h2>
              </div>
              <p className="text-[var(--color-text-secondary)] text-lg max-w-xl leading-relaxed">
                Dive into the most anticipated public events and community gatherings in your area.
              </p>
            </div>

            <Link href="/events">
              <Button variant="ghost" className="group text-[var(--color-brand)] font-bold text-sm uppercase tracking-widest gap-2">
                Browse All Events
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>

          <div className="relative">
            {/* Background Accent for Grid */}
            <div className="absolute -inset-4 bg-gradient-to-br from-[var(--color-brand)]/5 to-transparent blur-3xl rounded-[3rem] -z-10" />

            <EventList
              events={events}
              isLoading={isLoading}
              emptyTitle="The stage is quiet"
              emptyDescription="We couldn't find any public events right now. Why not create one?"
            />
          </div>

          {!isLoading && events.length === 0 && !session && (
            <div className="flex justify-center mt-16">
              <Link href="/signup">
                <Button variant="outline" className="h-14 px-8 border-dashed border-2 hover:border-[var(--color-brand)] transition-all gap-4">
                  <Calendar size={20} className="text-[var(--color-brand)]" />
                  <span>Launch Your First Event</span>
                  <ArrowRight size={16} className="opacity-40" />
                </Button>
              </Link>
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}