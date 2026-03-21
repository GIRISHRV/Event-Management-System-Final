import useSWR from 'swr';
import { supabase } from '@/services/supabase/client';
import { Booking, Profile } from '@/lib/supabase-types';
import { useToast } from '@/hooks/useToast';
import { logger } from '@/lib/logger';

export interface BookingWithProfile extends Booking {
  profiles: Profile;
}

// Two-step fetch: bookings first, then profiles by user_id.
// A direct join fails (PGRST200) because there's no FK from bookings→profiles in the schema cache.
const fetcher = async (eventId: string): Promise<BookingWithProfile[]> => {
  const { data: bookings, error: bookingError } = await supabase
    .from('bookings')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  if (bookingError) {
    throw new Error(`Bookings fetch failed: ${bookingError.message} (${bookingError.code})`);
  }
  if (!bookings || bookings.length === 0) return [];

  // Fetch profiles for each unique user
  const userIds = [...new Set(bookings.map((b) => b.user_id).filter(Boolean))];
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, username, full_name, role, avatar_url, created_at')
    .in('id', userIds);

  if (profileError) {
    throw new Error(`Profiles fetch failed: ${profileError.message} (${profileError.code})`);
  }

  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
  return bookings.map((b) => ({
    ...b,
    profiles: profileMap.get(b.user_id) ?? null,
  })) as BookingWithProfile[];
};

export function useEventBookings(eventId: string) {
  const { error: toastError } = useToast();

  const { data: bookings, isLoading, mutate } = useSWR<BookingWithProfile[]>(
    eventId ? ['bookings', eventId] : null,
    ([, id]) => fetcher(id as string),
    {
      onError: (err) => {
        logger.error('Error fetching bookings:', err);
        toastError('Failed to load guest list');
      }
    }
  );

  const updateBookingStatus = async (bookingId: string, newStatus: 'confirmed' | 'cancelled' | 'waitlist') => {
    try {
      // Optimistic update
      await mutate(
        (currentBookings) =>
          currentBookings?.map(b =>
            b.id === bookingId ? { ...b, status: newStatus } : b
          ),
        false
      );

      const { data, error } = await supabase
        .from('bookings')
        .update({ status: newStatus })
        .eq('id', bookingId)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error('Permission denied: You cannot update this booking.');
      }

      // Fire-and-forget: track confirmed interaction (#8)
      if (newStatus === 'confirmed' && data[0]) {
        const booking = data[0];
        supabase.from('user_interactions').upsert({
          user_id: booking.user_id,
          event_id: booking.event_id,
          interaction_type: 'confirmed',
          implicit_score: 1.0,
        }, { onConflict: 'user_id,event_id,interaction_type' }).then(() => {
          // Invalidate recommendation caches
          supabase.from('algorithm_results').delete()
            .eq('user_id', booking.user_id).eq('algorithm_type', 'xsimgcl');
          supabase.from('algorithm_results').delete()
            .eq('user_id', booking.user_id).eq('algorithm_type', 'gnn-cf');
        });
      }

      // Revalidate to ensure consistency
      mutate();

      return true;
    } catch (err) {
      logger.error('Error updating booking:', err);
      toastError('Failed to update booking status');
      // Revert changes
      mutate();
      return false;
    }
  };

  return {
    bookings: bookings || [],
    loading: isLoading,
    fetchBookings: mutate,
    updateBookingStatus
  };
}
