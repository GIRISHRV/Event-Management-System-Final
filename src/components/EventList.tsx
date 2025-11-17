"use client";

import Image from "next/image";
import { Edit2, Trash2 } from "lucide-react";
import type { Event } from "@/lib/supabase-types";

interface EventListProps {
  events: Event[];
  onEdit: (event: Event) => void;
  onDelete: (eventId: string) => void;
  isLoading?: boolean;
}

export function EventList({
  events,
  onEdit,
  onDelete,
  isLoading = false,
}: EventListProps) {
  if (events.length === 0) {
    return (
      <div className="p-8 text-center border border-gray-200 dark:border-zinc-700 rounded-lg bg-gray-50 dark:bg-zinc-900/50">
        <p className="text-gray-600 dark:text-zinc-400 text-lg">No events created yet</p>
        <p className="text-gray-500 dark:text-zinc-500 text-sm mt-2">
          Create your first event to get started
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event) => (
        <div
          key={event.id}
          className="border border-gray-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900/50 overflow-hidden hover:border-green-300 dark:hover:border-green-600 transition"
        >
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  {event.event_name}
                </h3>
                {event.event_description && (
                  <p className="text-gray-600 dark:text-zinc-400 text-sm mb-3 line-clamp-2">
                    {event.event_description}
                  </p>
                )}
              </div>
              {event.event_banner_url && (
                <Image
                  src={event.event_banner_url}
                  alt={event.event_name}
                  width={96}
                  height={96}
                  className="w-24 h-24 object-cover rounded-lg ml-4"
                />
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4 text-sm">
              <div>
                <p className="text-gray-500 dark:text-zinc-500">Start Date</p>
                <p className="text-gray-900 dark:text-white">
                  {new Date(event.start_date).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-zinc-500">Start Time</p>
                <p className="text-gray-900 dark:text-white">{event.start_time}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-zinc-500">Timezone</p>
                <p className="text-gray-900 dark:text-white">{event.timezone || "UTC"}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4 text-sm">
              <div>
                <p className="text-gray-500 dark:text-zinc-500">End Date</p>
                <p className="text-gray-900 dark:text-white">
                  {new Date(event.end_date).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-zinc-500">End Time</p>
                <p className="text-gray-900 dark:text-white">{event.end_time}</p>
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-zinc-700">
              <button
                onClick={() => onEdit(event)}
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-green-700 dark:bg-green-600 hover:bg-green-800 dark:hover:bg-green-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Edit2 size={18} />
                Edit
              </button>
              <button
                onClick={() => onDelete(event.id)}
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Trash2 size={18} />
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
