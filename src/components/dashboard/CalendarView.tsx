"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

interface CalendarEvent {
  id: string;
  event_name: string;
  start_date: string;
  venue_city?: string | null;
  [key: string]: unknown;
}

interface CalendarViewProps {
  events: CalendarEvent[] | undefined;
}

export function CalendarView({ events }: CalendarViewProps) {
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const monthName = new Date(calYear, calMonth).toLocaleString("en-IN", { month: "long", year: "numeric" });

  // Build event map: "YYYY-MM-DD" → events[]
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events || []) {
      if (!e.start_date) continue;
      const d = typeof e.start_date === "string" ? e.start_date.split("T")[0] : "";
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(e);
    }
    return map;
  }, [events]);

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  };

  const selectedDateEvents = selectedDate ? (eventsByDate.get(selectedDate) ?? []) : [];

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Month Header */}
      <div className="flex items-center justify-between px-1">
        <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)] transition">←</button>
        <h3 className="font-bold text-[var(--color-text-primary)]">{monthName}</h3>
        <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)] transition">→</button>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
          <div key={d} className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider py-2">{d}</div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const hasEvents = eventsByDate.has(dateStr);
          const isSelected = selectedDate === dateStr;
          const isToday = dateStr === new Date().toISOString().split("T")[0];
          const eventCount = eventsByDate.get(dateStr)?.length ?? 0;

          return (
            <button
              key={day}
              onClick={() => setSelectedDate(isSelected ? null : dateStr)}
              className={`
                aspect-square rounded-xl flex flex-col items-center justify-center text-sm font-medium transition-all relative
                ${isSelected
                  ? "bg-[var(--color-brand)] text-white shadow-lg shadow-blue-500/20"
                  : isToday
                  ? "bg-[var(--color-brand)]/10 text-[var(--color-brand)] font-bold"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
                }
              `}
            >
              {day}
              {hasEvents && !isSelected && (
                <div className="flex gap-0.5 mt-0.5">
                  {Array.from({ length: Math.min(eventCount, 3) }).map((_, di) => (
                    <div key={di} className="w-1 h-1 rounded-full bg-[var(--color-brand)]" />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Date Events */}
      {selectedDate && (
        <div className="border-t border-[var(--color-border)] pt-4 space-y-2">
          <p className="text-xs font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">
            {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric" })}
          </p>
          {selectedDateEvents.length === 0 ? (
            <p className="text-sm text-[var(--color-text-tertiary)]">No events on this date.</p>
          ) : (
            selectedDateEvents.map(e => (
              <Link key={e.id} href={`/event/${e.id}`} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-background)] border border-[var(--color-border)] hover:border-[var(--color-brand)] transition-all group">
                <div className="w-2 h-8 rounded-full bg-[var(--color-brand)] flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate group-hover:text-[var(--color-brand)]">{e.event_name}</p>
                  <p className="text-[11px] text-[var(--color-text-tertiary)]">{e.venue_city || "Online"}</p>
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
