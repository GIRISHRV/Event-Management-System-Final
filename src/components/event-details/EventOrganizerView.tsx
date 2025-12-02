"use client";

import { useState, useEffect, useCallback } from "react";
import { useEventBookings } from "@/hooks/useEventBookings";
import { useToast } from "@/components/ui/Toast";
import { Check, X, Clock, Users, UserCheck, UserX, Search } from "lucide-react";
import Image from "next/image";

interface EventOrganizerViewProps {
  eventId: string;
  eventCapacity?: number;
}

export function EventOrganizerView({ eventId, eventCapacity }: EventOrganizerViewProps) {
  const { bookings, loading, fetchBookings, updateBookingStatus } = useEventBookings(eventId);
  const [filter, setFilter] = useState<'all' | 'waitlist' | 'confirmed' | 'cancelled'>('all');
  const [searchQuery, setSearchQuery] = useState("");
  const { success, Toast } = useToast();

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleUpdateStatus = async (bookingId: string, newStatus: 'confirmed' | 'cancelled' | 'waitlist') => {
    const result = await updateBookingStatus(bookingId, newStatus);
    if (result) {
      success(`Guest ${newStatus === 'confirmed' ? 'approved' : newStatus === 'cancelled' ? 'rejected' : 'moved to waitlist'}`);
    }
  };

  const stats = {
    total: bookings.length,
    confirmed: bookings.filter(b => b.status === 'confirmed').length,
    waitlist: bookings.filter(b => b.status === 'waitlist').length,
    cancelled: bookings.filter(b => b.status === 'cancelled').length,
  };

  const filteredBookings = bookings.filter(booking => {
    const matchesFilter = filter === 'all' || booking.status === filter;
    const matchesSearch = 
      booking.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.profiles?.username?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-xl backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-lg text-blue-500">
              <Users size={24} />
            </div>
            <div>
              <p className="text-sm text-zinc-400">Total Requests</p>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-xl backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/10 rounded-lg text-green-500">
              <UserCheck size={24} />
            </div>
            <div>
              <p className="text-sm text-zinc-400">Confirmed Guests</p>
              <p className="text-2xl font-bold text-white">{stats.confirmed} <span className="text-sm font-normal text-zinc-500">/ {eventCapacity || '∞'}</span></p>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-xl backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-500/10 rounded-lg text-yellow-500">
              <Clock size={24} />
            </div>
            <div>
              <p className="text-sm text-zinc-400">Waitlist</p>
              <p className="text-2xl font-bold text-white">{stats.waitlist}</p>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-xl backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-500/10 rounded-lg text-red-500">
              <UserX size={24} />
            </div>
            <div>
              <p className="text-sm text-zinc-400">Cancelled/Rejected</p>
              <p className="text-2xl font-bold text-white">{stats.cancelled}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Guest Management */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl backdrop-blur-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-800 flex flex-col md:flex-row gap-4 justify-between items-center">
          <h2 className="text-xl font-bold text-white">Guest Management</h2>
          
          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
              <input
                type="text"
                placeholder="Search guests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-green-500 transition-colors"
              />
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg p-1">
              {(['all', 'waitlist', 'confirmed', 'cancelled'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                    filter === f
                      ? 'bg-zinc-800 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-zinc-950/50 text-zinc-400 text-sm uppercase">
              <tr>
                <th className="px-6 py-4 font-medium">Guest</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Requested</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-zinc-500">
                    Loading guests...
                  </td>
                </tr>
              ) : filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-zinc-500">
                    No guests found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredBookings.map((booking) => (
                  <tr key={booking.id} className="group hover:bg-zinc-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden relative shrink-0">
                          {booking.profiles?.avatar_url ? (
                            <Image
                              src={booking.profiles.avatar_url}
                              alt={booking.profiles.full_name || 'User'}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-500">
                              <UserCheck size={20} />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-white">
                            {booking.profiles?.full_name || booking.profiles?.username || 'Unknown User'}
                          </p>
                          <p className="text-sm text-zinc-500">{booking.profiles?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        booking.status === 'confirmed'
                          ? 'bg-green-500/10 text-green-500 border-green-500/20'
                          : booking.status === 'waitlist'
                          ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                          : 'bg-red-500/10 text-red-500 border-red-500/20'
                      }`}>
                        {booking.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-400">
                      {new Date(booking.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {booking.status === 'waitlist' && (
                          <>
                            <button
                              onClick={() => handleUpdateStatus(booking.id, 'confirmed')}
                              className="p-2 bg-green-500/10 hover:bg-green-500/20 text-green-500 rounded-lg transition-colors"
                              title="Approve"
                            >
                              <Check size={18} />
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(booking.id, 'cancelled')}
                              className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors"
                              title="Reject"
                            >
                              <X size={18} />
                            </button>
                          </>
                        )}
                        {booking.status === 'confirmed' && (
                          <button
                            onClick={() => handleUpdateStatus(booking.id, 'waitlist')}
                            className="p-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 rounded-lg transition-colors"
                            title="Move to Waitlist"
                          >
                            <Clock size={18} />
                          </button>
                        )}
                        {booking.status === 'cancelled' && (
                          <button
                            onClick={() => handleUpdateStatus(booking.id, 'waitlist')}
                            className="p-2 bg-zinc-500/10 hover:bg-zinc-500/20 text-zinc-400 rounded-lg transition-colors"
                            title="Restore to Waitlist"
                          >
                            <Clock size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Toast />
    </div>
  );
}
