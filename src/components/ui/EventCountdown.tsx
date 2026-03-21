"use client";

import { useState, useEffect, memo } from "react";
import { Clock } from "lucide-react";

interface EventCountdownProps {
  startDate: string;
  startTime?: string;
  compact?: boolean;
  className?: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
  isToday: boolean;
  isThisWeek: boolean;
}

function calculateTimeLeft(startDate: string, startTime?: string): TimeLeft {
  const eventDate = new Date(startDate);
  if (startTime) {
    const [hours, minutes] = startTime.split(":");
    eventDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
  } else {
    eventDate.setHours(0, 0, 0, 0);
  }

  const now = new Date();
  const diff = eventDate.getTime() - now.getTime();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDay = new Date(startDate);
  eventDay.setHours(0, 0, 0, 0);

  const isToday = eventDay.getTime() === today.getTime();
  const weekFromNow = new Date(today);
  weekFromNow.setDate(weekFromNow.getDate() + 7);
  const isThisWeek = eventDay <= weekFromNow && eventDay >= today;

  if (diff <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isPast: true,
      isToday,
      isThisWeek,
    };
  }

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
    isPast: false,
    isToday,
    isThisWeek,
  };
}

export const EventCountdown = memo(function EventCountdown({
  startDate,
  startTime,
  compact = false,
  className = "",
}: EventCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() =>
    calculateTimeLeft(startDate, startTime)
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(startDate, startTime));
    }, 1000);

    return () => clearInterval(timer);
  }, [startDate, startTime]);

  if (timeLeft.isPast) {
    return (
      <span className={`text-zinc-500 text-sm font-medium ${className}`}>
        Event has started
      </span>
    );
  }

  // Compact version for event cards
  if (compact) {
    if (timeLeft.isToday) {
      return (
        <span className={`text-blue-400 text-sm font-semibold flex items-center gap-2 ${className}`}>
          <Clock size={16} className="animate-pulse" />
          Today {startTime && `at ${startTime}`}
        </span>
      );
    }

    if (timeLeft.days === 0) {
      return (
        <span className={`text-orange-400 text-sm font-semibold flex items-center gap-2 ${className}`}>
          <Clock size={16} />
          In {timeLeft.hours}h {timeLeft.minutes}m
        </span>
      );
    }

    if (timeLeft.days === 1) {
      return (
        <span className={`text-yellow-400 text-sm font-semibold flex items-center gap-2 ${className}`}>
          <Clock size={16} />
          Tomorrow
        </span>
      );
    }

    if (timeLeft.isThisWeek) {
      return (
        <span className={`text-blue-400 text-sm font-semibold flex items-center gap-2 ${className}`}>
          <Clock size={16} />
          In {timeLeft.days} days
        </span>
      );
    }

    return (
      <span className={`text-zinc-400 text-sm font-medium flex items-center gap-2 ${className}`}>
        <Clock size={16} />
        {timeLeft.days}d {timeLeft.hours}h
      </span>
    );
  }

  // Full countdown display
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <div className="text-center">
        <div className="text-3xl font-bold text-white">{timeLeft.days}</div>
        <div className="text-xs text-zinc-400 uppercase font-semibold">Days</div>
      </div>
      <span className="text-zinc-600 text-2xl font-bold">:</span>
      <div className="text-center">
        <div className="text-3xl font-bold text-white">{timeLeft.hours}</div>
        <div className="text-xs text-zinc-400 uppercase font-semibold">Hours</div>
      </div>
      <span className="text-zinc-600 text-2xl font-bold">:</span>
      <div className="text-center">
        <div className="text-3xl font-bold text-white">{timeLeft.minutes}</div>
        <div className="text-xs text-zinc-400 uppercase font-semibold">Mins</div>
      </div>
      <span className="text-zinc-600 text-2xl font-bold">:</span>
      <div className="text-center">
        <div className="text-3xl font-bold text-blue-600">{timeLeft.seconds}</div>
        <div className="text-xs text-zinc-400 uppercase font-semibold">Secs</div>
      </div>
    </div>
  );
});
