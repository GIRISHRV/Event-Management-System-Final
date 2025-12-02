"use client";

import { Calendar, Ticket, Search, Plus, Sparkles } from "lucide-react";

interface EmptyStateProps {
  type: "my-events" | "attending" | "discover" | "favorites" | "recently-viewed";
  onAction?: () => void;
  filtered?: boolean;
}

export function EmptyState({ type, onAction, filtered = false }: EmptyStateProps) {
  const states = {
    "my-events": {
      icon: Calendar,
      title: filtered ? "No events match your filters" : "No events created yet",
      description: filtered 
        ? "Try adjusting your search or filters to find events" 
        : "Start by creating your first event and share it with the world!",
      actionLabel: filtered ? "Clear Filters" : "Create Your First Event",
      illustration: (
        <div className="relative mb-6">
          <div className="w-32 h-32 mx-auto rounded-full bg-linear-to-br from-green-500/20 to-emerald-500/10 flex items-center justify-center">
            <Calendar size={48} className="text-green-500" />
          </div>
          <div className="absolute -top-2 -right-8 w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700">
            <Plus size={20} className="text-zinc-400" />
          </div>
        </div>
      ),
    },
    attending: {
      icon: Ticket,
      title: filtered ? "No events match your filters" : "Not attending any events yet",
      description: filtered 
        ? "Try adjusting your search or filters" 
        : "Discover and RSVP to exciting events near you!",
      actionLabel: filtered ? "Clear Filters" : "Discover Events",
      illustration: (
        <div className="relative mb-6">
          <div className="w-32 h-32 mx-auto rounded-full bg-linear-to-br from-blue-500/20 to-cyan-500/10 flex items-center justify-center">
            <Ticket size={48} className="text-blue-500" />
          </div>
          <div className="absolute -bottom-2 -right-4 flex -space-x-2">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="w-8 h-8 rounded-full bg-zinc-700 border-2 border-zinc-900 flex items-center justify-center"
                style={{ opacity: 1 - i * 0.2 }}
              >
                <span className="text-xs text-zinc-400">👤</span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    discover: {
      icon: Search,
      title: filtered ? "No events found" : "No public events available",
      description: filtered 
        ? "Try different search terms or filters" 
        : "Check back later for new exciting events!",
      actionLabel: filtered ? "Clear Filters" : undefined,
      illustration: (
        <div className="relative mb-6">
          <div className="w-32 h-32 mx-auto rounded-full bg-linear-to-br from-purple-500/20 to-pink-500/10 flex items-center justify-center">
            <Search size={48} className="text-purple-500" />
          </div>
          <div className="absolute top-0 right-4 animate-pulse">
            <Sparkles size={24} className="text-amber-400" />
          </div>
        </div>
      ),
    },
    favorites: {
      icon: Calendar,
      title: "No saved events",
      description: "Save events from the Discover tab to find them easily later!",
      actionLabel: "Discover Events",
      illustration: (
        <div className="relative mb-6">
          <div className="w-32 h-32 mx-auto rounded-full bg-linear-to-br from-rose-500/20 to-pink-500/10 flex items-center justify-center">
            <svg
              className="w-12 h-12 text-rose-500"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </div>
        </div>
      ),
    },
    "recently-viewed": {
      icon: Calendar,
      title: "No recently viewed events",
      description: "Events you view will appear here for quick access",
      actionLabel: "Discover Events",
      illustration: (
        <div className="relative mb-6">
          <div className="w-32 h-32 mx-auto rounded-full bg-linear-to-br from-cyan-500/20 to-teal-500/10 flex items-center justify-center">
            <svg
              className="w-12 h-12 text-cyan-500"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>
      ),
    },
  };

  const state = states[type];

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      {state.illustration}
      <h3 className="text-xl font-semibold text-white mb-2">{state.title}</h3>
      <p className="text-zinc-400 text-center max-w-sm mb-6">
        {state.description}
      </p>
      {state.actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-all shadow-lg shadow-green-900/20 flex items-center gap-2"
        >
          {type === "my-events" && !filtered && <Plus size={18} />}
          {state.actionLabel}
        </button>
      )}
    </div>
  );
}
