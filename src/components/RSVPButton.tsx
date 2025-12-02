'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useSupabaseAuth } from '@/hooks/useSupabase';
import { Booking } from '@/lib/supabase-types';
import { useToast } from "@/components/Toast";

interface RSVPButtonProps {
  eventId: string;
}

export default function RSVPButton({ eventId }: RSVPButtonProps) {
  const { session, loading: authLoading } = useSupabaseAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const { success, error: toastError, Toast } = useToast();
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
      } catch (error) {
        console.error('Error checking booking:', JSON.stringify(error, null, 2));
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
        success('Request sent! Added to waitlist.');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toastError(`Failed to update RSVP: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <button disabled className="w-full sm:w-auto px-8 py-3 rounded-xl bg-zinc-800/50 text-zinc-500 font-semibold animate-pulse border border-zinc-700/50">
        Loading...
      </button>
    );
  }

  if (!session) {
    return (
      <button
        onClick={() => router.push('/signin')}
        className="w-full sm:w-auto px-8 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-all shadow-lg hover:shadow-blue-200"
      >
        Sign in to Join Event
      </button>
    );
  }

  if (booking?.status === 'waitlist') {
    return (
      <button
        onClick={handleRSVP}
        className="w-full sm:w-auto px-8 py-3 rounded-xl font-semibold transition-all shadow-lg bg-yellow-500/10 text-yellow-500 border-2 border-yellow-500/20 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20"
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
    <>
      <button
        onClick={handleRSVP}
        className={`w-full sm:w-auto px-8 py-3 rounded-xl font-semibold transition-all shadow-lg ${
          booking
            ? 'bg-green-50 text-green-700 border-2 border-green-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200'
            : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-blue-200'
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
      <Toast />
    </>
  );
}
