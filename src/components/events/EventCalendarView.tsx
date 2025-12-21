"use client";

import { useState, useMemo, memo } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import type { Event } from "@/lib/supabase-types";

interface EventCalendarViewProps {
  events: Event[];
  isLoading?: boolean;
  onEventClick?: (event: Event) => void;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: Event[];
}

export const EventCalendarView = memo(function EventCalendarView({
  events,
  isLoading = false,
  onEventClick,
}: EventCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  if (isLoading) {
    return (
      <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-6 animate-pulse">
        <div className="flex items-center justify-between mb-6">
          <div className="h-8 w-48 bg-zinc-800 rounded" />
          <div className="flex gap-2">
            <div className="h-8 w-8 bg-zinc-800 rounded-full" />
            <div className="h-8 w-8 bg-zinc-800 rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-7 gap-4 mb-4">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-6 w-full bg-zinc-800 rounded" />
          ))}
        </div>
        <div className="grid grid-cols-7 gap-4">
          {[...Array(35)].map((_, i) => (
            <div key={i} className="h-24 w-full bg-zinc-800 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);

    // Start from the Sunday before the first day
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    // End on the Saturday after the last day
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

    const days: CalendarDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const currentDateIterator = new Date(startDate);
    while (currentDateIterator <= endDate) {
      const dateStr = currentDateIterator.toISOString().split("T")[0];
      const dayEvents = events.filter((e) => e.start_date === dateStr);

      days.push({
        date: new Date(currentDateIterator),
        isCurrentMonth: currentDateIterator.getMonth() === month,
        isToday: currentDateIterator.getTime() === today.getTime(),
        events: dayEvents,
      });

      currentDateIterator.setDate(currentDateIterator.getDate() + 1);
    }

    return days;
  }, [currentDate, events]);

  const monthYear = currentDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const goToPrevMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="bg-zinc-950 rounded-2xl border border-zinc-800 overflow-hidden shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-zinc-800 bg-zinc-900/30">
        <div className="flex items-center gap-4">
          <div className="relative group flex items-center gap-2">
            <h2 className="text-2xl font-bold text-white tracking-tight group-hover:text-primary transition-colors cursor-pointer">
              {monthYear}
            </h2>
            <CalendarIcon className="w-5 h-5 text-zinc-500 group-hover:text-primary transition-colors" />
            <input
              type="date"
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
              value={currentDate.toISOString().split('T')[0]}
              onChange={(e) => {
                if (e.target.value) {
                  setCurrentDate(new Date(e.target.value));
                }
              }}
              aria-label="Jump to date"
            />
          </div>
          <button
            onClick={goToToday}
            className="px-4 py-1.5 text-sm font-medium bg-primary/10 text-primary rounded-full hover:bg-primary/20 transition border border-primary/20"
          >
            Today
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevMonth}
            className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white transition border border-transparent hover:border-zinc-700"
            aria-label="Previous month"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={goToNextMonth}
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
            aria-label="Next month"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Week day headers */}
      <div className="grid grid-cols-7 border-b border-zinc-800">
        {weekDays.map((day) => (
          <div
            key={day}
            className="p-3 text-center text-sm font-medium text-zinc-500"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 auto-rows-fr bg-zinc-950">
        {calendarDays.map((day, index) => (
          <div
            key={index}
            className={`h-32 p-2 border-b border-r border-zinc-800/50 transition-colors hover:bg-zinc-900/50 ${
              !day.isCurrentMonth ? "bg-zinc-900/30" : ""
            } ${day.isToday ? "bg-primary/10" : ""}`}
          >
            {/* Date number */}
            <div
              className={`text-sm font-medium mb-1 ${
                day.isToday
                  ? "w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center"
                  : day.isCurrentMonth
                  ? "text-zinc-300"
                  : "text-zinc-600"
              }`}
            >
              {day.date.getDate()}
            </div>

            {/* Events */}
            <div className="space-y-1">
              {day.events.slice(0, 2).map((event) => (
                <Link
                  key={event.id}
                  href={`/event/${event.id}`}
                  onClick={(e) => {
                    if (onEventClick) {
                      e.preventDefault();
                      onEventClick(event);
                    }
                  }}
                  className="block text-xs px-2 py-1 rounded bg-primary/20 text-primary hover:bg-primary/30 transition truncate"
                  title={event.event_name}
                >
                  {event.start_time && (
                    <span className="text-primary/70 mr-1">
                      {event.start_time.slice(0, 5)}
                    </span>
                  )}
                  {event.event_name}
                </Link>
              ))}
              {day.events.length > 2 && (
                <div className="text-xs text-zinc-500 px-2">
                  +{day.events.length - 2} more
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="p-4 border-t border-zinc-800 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-primary" />
          <span className="text-sm text-zinc-400">Today</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-primary/20" />
          <span className="text-sm text-zinc-400">Event</span>
        </div>
      </div>
    </div>
  );
});
