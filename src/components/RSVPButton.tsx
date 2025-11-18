"use client";

import { useState, useEffect } from "react";
import { Check, X, Clock } from "lucide-react";
import { respondToRSVP, getUserRSVPStatus } from "@/lib/events";
import type { Event } from "@/lib/supabase-types";

interface RSVPButtonProps {
  event: Event;
  userEmail: string;
  onRSVPUpdate?: () => void;
}

export function RSVPButton({ event, userEmail, onRSVPUpdate }: RSVPButtonProps) {
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    const fetchRSVPStatus = async () => {
      try {
        const status = await getUserRSVPStatus(event.id, userEmail);
        setCurrentStatus(status);
      } catch (error) {
        console.error("Error fetching RSVP status:", error);
      } finally {
        setInitialLoading(false);
      }
    };

    if (event.id && userEmail) {
      fetchRSVPStatus();
    }
  }, [event.id, userEmail]);

  const handleRSVP = async (status: 'going' | 'not_going' | 'maybe') => {
    setLoading(true);
    try {
      await respondToRSVP(event.id, userEmail, status);
      setCurrentStatus(status);
      onRSVPUpdate?.();
    } catch (error) {
      console.error("Error updating RSVP:", error);
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 dark:text-zinc-400">
        <Clock size={16} />
        <span className="text-sm">Loading...</span>
      </div>
    );
  }

  // Don't show RSVP button to event owner
  if (event.user_email === userEmail) {
    return null;
  }

  // Don't show if RSVP not required
  if (!event.rsvp_required) {
    return null;
  }

  const buttonClass = "px-4 py-2 rounded-lg font-medium transition text-sm";
  const activeClass = "ring-2 ring-offset-2 ring-green-500 dark:ring-offset-zinc-900";

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => handleRSVP('going')}
        disabled={loading}
        className={`${buttonClass} ${
          currentStatus === 'going'
            ? `bg-green-600 text-white ${activeClass}`
            : 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
        } disabled:opacity-50`}
      >
        <Check size={16} className="inline mr-1" />
        Going
      </button>
      
      <button
        onClick={() => handleRSVP('maybe')}
        disabled={loading}
        className={`${buttonClass} ${
          currentStatus === 'maybe'
            ? `bg-yellow-600 text-white ${activeClass}`
            : 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
        } disabled:opacity-50`}
      >
        <Clock size={16} className="inline mr-1" />
        Maybe
      </button>
      
      <button
        onClick={() => handleRSVP('not_going')}
        disabled={loading}
        className={`${buttonClass} ${
          currentStatus === 'not_going'
            ? `bg-red-600 text-white ${activeClass}`
            : 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
        } disabled:opacity-50`}
      >
        <X size={16} className="inline mr-1" />
        Can&apos;t Go
      </button>
    </div>
  );
}