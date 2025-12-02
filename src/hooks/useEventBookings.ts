import useSWR from 'swr';
import { supabase } from '@/lib/supabase';
import { Booking, Profile } from '@/lib/supabase-types';
import { useToast } from '@/components/ui/Toast';

export interface BookingWithProfile extends Booking {
  profiles: Profile;
}

const fetcher = async (eventId: string) => {
  // First fetch bookings
  const { data: bookingsData, error: bookingsError } = await supabase
    .from('bookings')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  if (bookingsError) throw bookingsError;

  if (!bookingsData || bookingsData.length === 0) {
    return [];
  }

  // Then fetch profiles for these bookings
  const userIds = bookingsData.map(b => b.user_id);
  const { data: profilesData, error: profilesError } = await supabase
    .from('profiles')
    .select('*')
    .in('id', userIds);

  if (profilesError) throw profilesError;

  // Combine data
  const profilesMap = new Map(profilesData?.map(p => [p.id, p]));
  return bookingsData.map(booking => ({
    ...booking,
    profiles: profilesMap.get(booking.user_id) || {
      id: booking.user_id,
      email: 'Unknown',
      role: 'customer',
      created_at: new Date().toISOString()
    } as Profile
  }));
};

export function useEventBookings(eventId: string) {
  const { error: toastError } = useToast();

  const { data: bookings, isLoading, mutate } = useSWR<BookingWithProfile[]>(
    eventId ? ['bookings', eventId] : null,
    ([, id]) => fetcher(id as string),
    {
      onError: (err) => {
        console.error('Error fetching bookings:', err);
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

      // Revalidate to ensure consistency
      mutate();
      
      return true;
    } catch (err) {
      console.error('Error updating booking:', err);
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
