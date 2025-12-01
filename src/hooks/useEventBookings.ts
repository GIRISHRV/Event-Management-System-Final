import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Booking, Profile } from '@/lib/supabase-types';
import { useToast } from '@/components/Toast';

export interface BookingWithProfile extends Booking {
  profiles: Profile;
}

export function useEventBookings(eventId: string) {
  const [bookings, setBookings] = useState<BookingWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const { error: toastError } = useToast();

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      
      // First fetch bookings
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

      if (bookingsError) throw bookingsError;

      if (!bookingsData || bookingsData.length === 0) {
        setBookings([]);
        return;
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
      const combinedData = bookingsData.map(booking => ({
        ...booking,
        profiles: profilesMap.get(booking.user_id) || {
          id: booking.user_id,
          email: 'Unknown',
          role: 'customer',
          created_at: new Date().toISOString()
        } as Profile
      }));

      setBookings(combinedData);
    } catch (err) {
      console.error('Error fetching bookings:', JSON.stringify(err, null, 2));
      toastError('Failed to load guest list');
    } finally {
      setLoading(false);
    }
  }, [eventId, toastError]);

  const updateBookingStatus = async (bookingId: string, newStatus: 'confirmed' | 'cancelled' | 'waitlist') => {
    try {
      console.log(`Attempting to update booking ${bookingId} to ${newStatus}`);
      const { data, error } = await supabase
        .from('bookings')
        .update({ status: newStatus })
        .eq('id', bookingId)
        .select();

      if (error) {
        console.error('Supabase update error:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.error('No rows updated. This usually means Row Level Security (RLS) is blocking the update because you are not the owner of the booking.');
        throw new Error('Permission denied: You cannot update this booking.');
      }

      setBookings(prev => prev.map(b => 
        b.id === bookingId ? { ...b, status: newStatus } : b
      ));
      
      return true;
    } catch (err) {
      console.error('Error updating booking:', err);
      toastError('Failed to update booking status');
      return false;
    }
  };

  return {
    bookings,
    loading,
    fetchBookings,
    updateBookingStatus
  };
}
