"use client";

import { useMemo, memo } from "react";
import { Calendar, Users, TrendingUp } from "lucide-react";
import type { Event } from "@/lib/supabase-types";

interface EventStatsCardsProps {
  myEvents: Event[];
  bookedEvents: Event[];
}

export const EventStatsCards = memo(function EventStatsCards({
  myEvents,
  bookedEvents,
}: EventStatsCardsProps) {
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Calculate upcoming events (from both created and booked)
    const upcomingCreated = myEvents.filter(
      (e) => new Date(e.start_date) >= today
    ).length;
    const upcomingBooked = bookedEvents.filter(
      (e) => new Date(e.start_date) >= today
    ).length;

    // Calculate attended (past booked events)
    const attended = bookedEvents.filter(
      (e) => new Date(e.start_date) < today
    ).length;

    // Calculate events created this month
    const createdThisMonth = myEvents.filter(
      (e) => new Date(e.created_at) >= startOfMonth
    ).length;

    return {
      upcomingCount: upcomingCreated + upcomingBooked,
      attendedCount: attended,
      createdThisMonth,
    };
  }, [myEvents, bookedEvents]);

  const statCards = [
    {
      label: "Upcoming",
      value: stats.upcomingCount,
      icon: Calendar,
    },
    {
      label: "Attended",
      value: stats.attendedCount,
      icon: Users,
    },
    {
      label: "Created This Month",
      value: stats.createdThisMonth,
      icon: TrendingUp,
    },
  ];

  return (
    <div className="mb-8">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm transition-all hover:scale-[1.02]"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-400">{stat.label}</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {stat.value}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-zinc-800/50">
                <stat.icon className="text-zinc-400" size={24} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
