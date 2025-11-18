"use client";

import { EnhancedEventForm } from "./EnhancedEventForm";
import type { Event, CreateEventInput } from "@/lib/supabase-types";

interface EventFormProps {
  event?: Event;
  onSubmit: (data: CreateEventInput) => Promise<void>;
  onClose: () => void;
  isLoading?: boolean;
  userEmail?: string;
}

export function EventForm(props: EventFormProps) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4" style={{zIndex: 9999}}>
      <div className="bg-zinc-900 rounded-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto border border-zinc-700 shadow-2xl">
        <div className="p-6">
          <EnhancedEventForm {...props} />
        </div>
      </div>
    </div>
  );
}
