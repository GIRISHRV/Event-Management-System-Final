"use client";

import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-12 h-12 text-green-500 animate-spin" />
        <p className="text-zinc-400 text-lg">Loading...</p>
      </div>
    </div>
  );
}
