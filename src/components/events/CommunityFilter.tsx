// src/components/events/CommunityFilter.tsx
// Community filter chips shown above the event grid on the Discover tab.
// Clicking a chip filters publicEvents to only show events in that community.

"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";

interface Community {
  communityId: number;
  label: string;
  eventIds: string[];
  characteristics: string[];
}

interface Props {
  onFilter: (eventIds: string[] | null) => void;
}

export function CommunityFilter({ onFilter }: Props) {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/algorithms/communities");
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.communities?.length > 0) {
          const filtered = data.communities
            .filter((c: Community) => c.eventIds.length >= 3)
            .sort((a: Community, b: Community) => b.eventIds.length - a.eventIds.length);
          setCommunities(filtered);
        }
      } catch {
        // Non-critical — hide silently
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function handleChipClick(community: Community) {
    if (activeId === community.communityId) {
      setActiveId(null);
      onFilter(null);
    } else {
      setActiveId(community.communityId);
      onFilter(community.eventIds);
    }
  }

  function handleClear() {
    setActiveId(null);
    onFilter(null);
  }

  if (loading || communities.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-tertiary)]">
          <Sparkles size={11} className="text-[var(--color-brand)]" />
          Communities
        </span>

        {communities.map((c) => {
          const isActive = activeId === c.communityId;
          return (
            <button
              key={c.communityId}
              onClick={() => handleChipClick(c)}
              className={`
                inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold
                border transition-all duration-200
                ${isActive
                  ? "bg-[var(--color-brand)] text-white border-[var(--color-brand)] shadow-md shadow-blue-500/20"
                  : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
                }
              `}
            >
              {c.label} <span className="font-normal opacity-75">({c.eventIds.length})</span>
            </button>
          );
        })}

        {activeId !== null && (
          <button
            onClick={handleClear}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs text-[var(--color-text-tertiary)] hover:text-red-400 transition-colors"
          >
            <X size={11} /> Clear
          </button>
        )}
      </div>

      {activeId !== null && (
        <p className="text-[11px] text-[var(--color-text-tertiary)]">
          Showing events in{" "}
          <span className="font-semibold text-[var(--color-brand)]">
            {communities.find((c) => c.communityId === activeId)?.label}
          </span>
        </p>
      )}
    </div>
  );
}