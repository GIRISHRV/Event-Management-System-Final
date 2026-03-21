"use client";

import { useState, useEffect, memo, useCallback } from "react";
import Image from "next/image";
import { Users } from "lucide-react";
import { supabase } from "@/services/supabase/client";

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

  const fetchAttendees = useCallback(async () => {
    try {
      const { data: bookingsData, error: bookingsError, count } = await supabase
        .from("bookings")
        .select("user_id", { count: "exact" })
        .eq("event_id", eventId)
        .eq("status", "confirmed")
        .limit(maxDisplay);

      if (bookingsError) throw bookingsError;

      if (!bookingsData || bookingsData.length === 0) {
        setAttendees([]);
        setTotalCount(0);
        return;
      }

      const userIds = bookingsData.map((b) => b.user_id).filter(Boolean);
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      const attendeeList: Attendee[] = (profilesData || []).map((profile) => ({
        id: profile.id,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
      }));

      setAttendees(attendeeList);
      setTotalCount(count || 0);
    } catch {
      setAttendees([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [eventId, maxDisplay]);

  useEffect(() => {
    fetchAttendees();
  }, [fetchAttendees]);

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
              className={`${sizeClasses[size]} ${i > 0 ? overlapClasses[size] : ""} rounded-full bg-[#2b2b2b] animate-pulse border-2 border-[#1a1a1a]`}
            />
          ))}
        </div>
      </div>
    );
  }

  if (totalCount === 0) {
    return (
      <div className={`flex items-center gap-2 text-zinc-400 ${className}`}>
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
            className={`${sizeClasses[size]} ${index > 0 ? overlapClasses[size] : ""} rounded-full border-2 border-[#1a1a1a] bg-[#2b2b2b] overflow-hidden relative`}
            title={attendee.full_name || "Attendee"}
          >
            {attendee.avatar_url ? (
              <Image
                src={attendee.avatar_url}
                alt={attendee.full_name || "Attendee"}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#2563eb] to-blue-600 text-white font-medium">
                {attendee.full_name?.[0]?.toUpperCase() || "?"}
              </div>
            )}
          </div>
        ))}

        {remainingCount > 0 && (
          <div
            className={`${sizeClasses[size]} ${overlapClasses[size]} rounded-full border-2 border-[#1a1a1a] bg-[#2b2b2b] flex items-center justify-center text-zinc-300 font-medium`}
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
