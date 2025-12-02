"use client";

import { useState, useEffect, memo } from "react";
import Image from "next/image";
import { Users } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Attendee {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface AttendeeAvatarsProps {
  eventId: string;
  maxDisplay?: number;
  size?: "sm" | "md" | "lg";
  showCount?: boolean;
  className?: string;
}

export const AttendeeAvatars = memo(function AttendeeAvatars({
  eventId,
  maxDisplay = 5,
  size = "md",
  showCount = true,
  className = "",
}: AttendeeAvatarsProps) {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAttendees = async () => {
      try {
        // Get confirmed bookings with profile info
        const { data, error, count } = await supabase
          .from("bookings")
          .select(
            `
            user_id,
            profiles!inner (
              id,
              full_name,
              avatar_url
            )
          `,
            { count: "exact" }
          )
          .eq("event_id", eventId)
          .eq("status", "confirmed")
          .limit(maxDisplay);

        if (error) throw error;

        const attendeeList: Attendee[] = (data || [])
          .map((booking) => {
            const profile = booking.profiles as unknown as Attendee;
            return profile
              ? {
                  id: profile.id,
                  full_name: profile.full_name,
                  avatar_url: profile.avatar_url,
                }
              : null;
          })
          .filter((a): a is Attendee => a !== null);

        setAttendees(attendeeList);
        setTotalCount(count || 0);
      } catch {
        // Failed to fetch attendees - show empty state
        setAttendees([]);
        setTotalCount(0);
      } finally {
        setLoading(false);
      }
    };

    fetchAttendees();
  }, [eventId, maxDisplay]);

  const sizeClasses = {
    sm: "w-6 h-6 text-xs",
    md: "w-8 h-8 text-sm",
    lg: "w-10 h-10 text-base",
  };

  const overlapClasses = {
    sm: "-ml-2",
    md: "-ml-3",
    lg: "-ml-4",
  };

  if (loading) {
    return (
      <div className={`flex items-center ${className}`}>
        <div className="flex">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className={`${sizeClasses[size]} ${i > 0 ? overlapClasses[size] : ""} rounded-full bg-zinc-700 animate-pulse border-2 border-zinc-900`}
            />
          ))}
        </div>
      </div>
    );
  }

  if (totalCount === 0) {
    return (
      <div className={`flex items-center gap-2 text-zinc-500 ${className}`}>
        <Users size={size === "sm" ? 14 : size === "md" ? 16 : 20} />
        <span className="text-sm">No attendees yet</span>
      </div>
    );
  }

  const remainingCount = totalCount - attendees.length;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="flex">
        {attendees.map((attendee, index) => (
          <div
            key={attendee.id}
            className={`${sizeClasses[size]} ${index > 0 ? overlapClasses[size] : ""} rounded-full border-2 border-zinc-900 bg-zinc-700 overflow-hidden relative`}
            title={attendee.full_name || "Attendee"}
          >
            {attendee.avatar_url ? (
              <Image
                src={attendee.avatar_url}
                alt={attendee.full_name || "Attendee"}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-green-500 to-green-600 text-white font-medium">
                {attendee.full_name?.[0]?.toUpperCase() || "?"}
              </div>
            )}
          </div>
        ))}

        {remainingCount > 0 && (
          <div
            className={`${sizeClasses[size]} ${overlapClasses[size]} rounded-full border-2 border-zinc-900 bg-zinc-800 flex items-center justify-center text-zinc-300 font-medium`}
          >
            +{remainingCount}
          </div>
        )}
      </div>

      {showCount && (
        <span className="text-sm text-zinc-400">
          {totalCount} {totalCount === 1 ? "attendee" : "attendees"}
        </span>
      )}
    </div>
  );
});
