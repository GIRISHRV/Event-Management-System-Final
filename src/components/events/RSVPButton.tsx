'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Booking } from '@/lib/supabase-types';
import { useToast } from "@/components/ui/Toast";
import { useConfetti } from "@/components/ui/Confetti";

interface RSVPButtonProps {
  eventId: string;
  onStatusChange?: (status: string | null) => void;
}

export default function RSVPButton({ eventId, onStatusChange }: RSVPButtonProps) {
  const { session, userProfile, loading: authLoading } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const { success, error: toastError, Toast } = useToast();
  const { triggerConfetti, Confetti } = useConfetti();
  const router = useRouter();

  useEffect(() => {
    const checkBooking = async () => {
      if (!session?.user) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('bookings')
          .select('*')
          .eq('event_id', eventId)
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (error) throw error;
        setBooking(data);
      } catch (err) {
        console.error('[RSVPButton] Error checking booking:', err);
        // Error checking booking - show as not booked
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      checkBooking();
    }
  }, [eventId, session, authLoading]);

  const handleRSVP = async () => {
    if (!session?.user) {
      router.push('/signin');
      return;
    }

    setLoading(true);
    try {
      if (booking) {
        // Cancel booking
        const { error } = await supabase
          .from('bookings')
          .delete()
          .eq('id', booking.id);
        
        if (error) throw error;
        
        setBooking(null);
        onStatusChange?.(null);
        success('RSVP cancelled successfully');
      } else {
        // Create booking
        const { data, error } = await supabase
          .from('bookings')
          .insert({
            event_id: eventId,
            user_id: session.user.id,
            status: 'waitlist'
          })
          .select()
          .single();
        
        if (error) throw error;
        
        setBooking(data);
        onStatusChange?.(data.status);
        success('Request sent! Added to waitlist.');
        triggerConfetti(); // 🎉 Confetti on RSVP!
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toastError(`Failed to update RSVP: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // Determine button content based on state
  const renderButton = () => {
    if (authLoading || loading) {
      return (
        <button disabled className="w-full sm:w-auto px-8 py-3 rounded-xl bg-zinc-800/50 text-zinc-500 font-semibold animate-pulse border border-zinc-700/50">
          Loading...
        </button>
      );
    }

    if (userProfile?.role === 'vendor') {
      return (
        <button
          disabled
          className="w-full sm:w-auto px-8 py-3 rounded-xl bg-zinc-800/50 text-zinc-500 font-semibold border border-zinc-700/50 cursor-not-allowed"
          title="Vendors cannot RSVP to events"
        >
          Vendors cannot RSVP
        </button>
      );
    }

    if (!session) {
      return (
        <button
          onClick={() => router.push('/signin')}
          className="w-full sm:w-auto px-8 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-all shadow-lg hover:shadow-primary/30"
        >
          Sign in to Join Event
        </button>
      );
    }

    if (booking?.status === 'waitlist') {
      return (
        <button
          onClick={handleRSVP}
          className="w-full sm:w-auto px-8 py-3 rounded-xl font-semibold transition-all shadow-lg bg-yellow-500/10 text-yellow-500 border-2 border-yellow-500/20 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20"
        >
          <span className="group flex items-center justify-center gap-2">
            <span className="group-hover:hidden flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Request Pending
            </span>
            <span className="hidden group-hover:flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel Request
            </span>
          </span>
        </button>
      );
    }

    return (
      <button
        onClick={handleRSVP}
        className={`w-full sm:w-auto px-8 py-3 rounded-xl font-semibold transition-all shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900 ${
          booking
            ? 'bg-primary/10 text-primary border-2 border-primary/20 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 focus:ring-primary'
            : 'bg-primary text-white hover:bg-primary/90 hover:shadow-primary/30 focus:ring-primary'
        }`}
      >
        {booking ? (
          <span className="group flex items-center justify-center gap-2">
            <span className="group-hover:hidden flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              You&apos;re Going!
            </span>
            <span className="hidden group-hover:flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel RSVP
            </span>
          </span>
        ) : (
          'Request to Join'
        )}
      </button>
    );
  };

  // Always render Confetti and Toast at top level so they work in all states
  return (
    <>
      <Confetti />
      {renderButton()}
      <Toast />
    </>
  );
}
