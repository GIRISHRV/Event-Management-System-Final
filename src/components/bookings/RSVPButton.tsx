"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useBookings } from "@/hooks/useBookings";
import { useToast } from "@/hooks/useToast";
import { useConfetti } from "@/components/ui/Confetti";
import { Button } from "@/components/ui/Button";
import { Loader2, CheckCircle2, Clock, XCircle, Sparkles } from "lucide-react";
import { EventRecommendations } from "@/components/events/EventRecommendations";
import { useMyEvents } from "@/hooks/useEvents";
import type { Event } from "@/lib/supabase-types";

interface RSVPButtonProps {
  eventId: string;
  className?: string;
}

export function RSVPButton({ eventId, className = "" }: RSVPButtonProps) {
  const { session, userProfile, loading: authLoading } = useAuth();
  const {
    userBooking,
    isBookingLoading,
    rsvpToEvent,
    cancelRsvp,
  } = useBookings(eventId);

  const { success, error: toastError } = useToast();
  const { triggerConfetti, Confetti } = useConfetti();
  const router = useRouter();

  const userId = session?.user?.id;
  const { events: bookedEvents } = useMyEvents(userId, { page: 1, limit: 10 });

  const handleRSVP = async () => {
    if (!session?.user) {
      router.push("/signin");
      return;
    }

    try {
      if (userBooking && userBooking.status !== "cancelled") {
        // Cancel logic
        await cancelRsvp(userBooking.id);
        success("RSVP cancelled successfully");
      } else {
        // RSVP logic
        const data = await rsvpToEvent();
        if (data?.status === "waitlist") {
          success("Added to waitlist. Event is at capacity.");
        } else {
          success("Request sent! You're going!");
          triggerConfetti();
        }
      }
    } catch (error: unknown) {
      toastError(`Failed to update RSVP: ${error instanceof Error ? error.message : "Unknown error"}`);
    }  };

  const renderContent = () => {
    if (authLoading || isBookingLoading) {
      return (
        <Button variant="outline" disabled className={`w-full sm:w-auto ${className}`}>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Checking status...
        </Button>
      );
    }

    if (userProfile?.role === "vendor") {
      return (
        <Button variant="outline" disabled className={`w-full sm:w-auto ${className}`} >
          Not available for vendors
        </Button>
      );
    }

    if (!session) {
      return (
        <Button variant="primary" onClick={() => router.push("/signin")} className={`w-full sm:w-auto ${className}`}>
          Sign in to Join
        </Button>
      );
    }

    // Active reservation (Confirmed or Waitlisted)
    if (userBooking && userBooking.status !== "cancelled") {
      const isWaitlisted = userBooking.status === "waitlist";
      
      return (
        <div className="flex flex-col gap-3 w-full">
          <div className={`
            flex items-center justify-center gap-3 p-4 rounded-[var(--radius-xl)] border transition-all shadow-lg
            ${isWaitlisted 
              ? "bg-amber-500/10 border-amber-500/30 text-amber-500" 
              : "bg-emerald-500 border-emerald-400 text-white shadow-emerald-500/20"
            }
          `}>
            {isWaitlisted ? (
              <><Clock className="w-5 h-5 animate-pulse" /> <span className="font-bold tracking-tight">Waitlisted</span></>
            ) : (
              <><CheckCircle2 className="w-5 h-5" /> <span className="font-bold tracking-tight text-lg">You&apos;re Going!</span></>
            )}
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRSVP}
            className="w-full text-[var(--color-text-tertiary)] hover:text-red-400 hover:bg-red-400/5 transition-all h-9 group"
          >
            <XCircle className="w-4 h-4 mr-2 opacity-50 group-hover:opacity-100" />
            <span className="text-xs font-bold uppercase tracking-widest">Cancel {isWaitlisted ? "Waitlist" : "RSVP"}</span>
          </Button>

          {/* Post-RSVP Recommendations (UX-05) */}
          {!isWaitlisted && userId && (
            <div className="mt-8 pt-6 border-t border-[var(--color-border)] animate-in fade-in slide-in-from-bottom-4 duration-1000">
              <div className="flex items-center gap-2 mb-4 text-[var(--color-brand)]">
                <Sparkles size={14} className="animate-pulse" />
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em]">What&apos;s Next?</h4>
              </div>
              <EventRecommendations 
                userId={userId} 
                bookedEvents={bookedEvents as Event[]} 
                limit={3} 
              />
            </div>
          )}
        </div>
      );
    }

    // Default State (Not booked or cancelled)
    return (
      <Button
        variant="primary"
        onClick={handleRSVP}
        className={`w-full sm:w-auto ${className}`}
      >
        Request to Join
      </Button>
    );
  };

  return (
    <>
      <Confetti />
      {renderContent()}
    </>
  );
}
