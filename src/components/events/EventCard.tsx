"use client";

import React, { useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";
import { MapPin, Calendar as CalendarIcon, Users, ArrowRight, Heart, Share2, Pencil, Trash2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { type EventRow } from "@/schemas/event.schema";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";

interface EventCardProps {
    event: EventRow;
    className?: string;
    showFavorite?: boolean;
    isFavorite?: boolean;
    onShare?: (event: EventRow, e: React.MouseEvent) => void;
    onToggleFavorite?: (event: EventRow, e: React.MouseEvent) => void;
    onEdit?: (event: EventRow) => void;
    onDelete?: (eventId: string) => void;
    trend?: "increasing" | "decreasing" | "stable";
}

const DEFAULT_BANNER = "https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=2070&auto=format&fit=crop";
const SESSION_KEY = "__loaded_banner_urls__";

function isUrlCached(url: string): boolean {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        const arr: string[] = raw ? JSON.parse(raw) : [];
        return arr.includes(url);
    } catch {
        return false;
    }
}

function cacheUrl(url: string): void {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        const arr: string[] = raw ? JSON.parse(raw) : [];
        if (!arr.includes(url)) {
            arr.push(url);
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(arr));
        }
    } catch {
        // sessionStorage unavailable (SSR) -- ignore
    }
}

export function EventCard({
    event,
    className,
    showFavorite = false,
    isFavorite = false,
    onShare,
    onToggleFavorite,
    onEdit,
    onDelete,
    trend,
}: EventCardProps) {
    const bannerUrl = event.event_banner_url || DEFAULT_BANNER;
    const hasActions = !!onEdit || !!onDelete;

    // Refs to the shimmer overlay and the image wrapper.
    // We manipulate these directly in onLoad to avoid any React state change,
    // which is what was causing the blur/shimmer transition to replay on every
    // Strict Mode remount and every parent re-render.
    const shimmerRef = useRef<HTMLDivElement>(null);
    const imgWrapperRef = useRef<HTMLDivElement>(null);

    // On mount: if this URL was already loaded in a previous mount cycle
    // (stored in sessionStorage), immediately hide the shimmer without
    // waiting for onLoad -- no transition, no blink.
    useEffect(() => {
        if (isUrlCached(bannerUrl)) {
            if (shimmerRef.current) {
                shimmerRef.current.style.opacity = "0";
                shimmerRef.current.style.pointerEvents = "none";
            }
            if (imgWrapperRef.current) {
                imgWrapperRef.current.style.filter = "none";
            }
        }
    }, [bannerUrl]);

    function handleLoad() {
        cacheUrl(bannerUrl);
        // Directly mutate the DOM -- no setState, no re-render, no transition replay.
        if (shimmerRef.current) {
            shimmerRef.current.classList.remove("animate-pulse");
            shimmerRef.current.style.transition = "opacity 0.5s";
            shimmerRef.current.style.opacity = "0";
            shimmerRef.current.style.pointerEvents = "none";
        }
        if (imgWrapperRef.current) {
            imgWrapperRef.current.style.transition = "filter 0.5s";
            imgWrapperRef.current.style.filter = "none";
        }
    }

    const alreadyLoaded = typeof window !== "undefined" && isUrlCached(bannerUrl);

    return (
        <div className={cn("relative group h-full", className)}>
            <Link href={`/event/${event.id}`} className="block h-full outline-none">
                <article
                    className={cn(
                        "flex flex-col h-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-xl)] overflow-hidden transition-colors duration-300",
                        "hover:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]",
                    )}
                >
                    <div className="relative w-full aspect-[16/10] overflow-hidden bg-[var(--color-surface-hover)]">

                        {/* Shimmer -- hidden immediately if URL is already cached */}
                        <div
                            ref={shimmerRef}
                            className={cn(
                                "absolute inset-0 bg-[var(--color-border)] z-10",
                                !alreadyLoaded && "animate-pulse"
                            )}
                            style={alreadyLoaded ? { opacity: 0, pointerEvents: "none" } : undefined}
                        />

                        {/* Image wrapper -- starts blurred unless already cached */}
                        <div
                            ref={imgWrapperRef}
                            className="absolute inset-0"
                            style={alreadyLoaded ? undefined : { filter: "blur(4px)" }}
                        >
                            <Image
                                src={bannerUrl}
                                alt={event.event_name}
                                fill
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                className="object-cover"
                                onLoad={handleLoad}
                            />
                        </div>

                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />

                        <div className="absolute top-3 left-3 z-20">
                            <Badge
                                variant={
                                    event.event_status === "upcoming" ? "success" :
                                        event.event_status === "ongoing" ? "warning" : "secondary"
                                }
                                className="backdrop-blur-md bg-white/10 text-white border-white/20 shadow-lg font-bold uppercase text-[10px]"
                            >
                                {event.event_status}
                            </Badge>
                        </div>

                        {trend && (
                            <div className="absolute top-3 left-[90px] z-20">
                                <Badge
                                    variant={trend === "increasing" ? "success" : trend === "decreasing" ? "danger" : "secondary"}
                                    className={cn(
                                        "backdrop-blur-md border-white/20 shadow-lg font-bold uppercase text-[9px] h-5 px-1.5",
                                        trend === "increasing" ? "bg-emerald-500/80 text-white" : 
                                        trend === "decreasing" ? "bg-rose-500/80 text-white" : 
                                        "bg-white/20 text-white"
                                    )}
                                >
                                    {trend === "increasing" ? <TrendingUp size={10} className="mr-1" /> : 
                                     trend === "decreasing" ? <TrendingDown size={10} className="mr-1" /> : 
                                     <Minus size={10} className="mr-1" />}
                                    {trend === "increasing" ? "Growing" : trend === "decreasing" ? "Declining" : "Stable"}
                                </Badge>
                            </div>
                        )}

                        {(showFavorite || onShare) && (
                            <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                {onShare && (
                                    <button
                                        type="button"
                                        onClick={(e) => { e.preventDefault(); onShare(event, e); }}
                                        className="p-1.5 rounded-full bg-black/40 backdrop-blur-sm text-white hover:bg-black/60 transition-colors"
                                        title="Share event"
                                    >
                                        <Share2 size={14} />
                                    </button>
                                )}
                                {showFavorite && onToggleFavorite && (
                                    <button
                                        type="button"
                                        onClick={(e) => { e.preventDefault(); onToggleFavorite(event, e); }}
                                        className={cn(
                                            "p-1.5 rounded-full backdrop-blur-sm transition-colors",
                                            isFavorite
                                                ? "bg-red-500/80 text-white hover:bg-red-600/80"
                                                : "bg-black/40 text-white hover:bg-black/60"
                                        )}
                                        title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                                    >
                                        <Heart size={14} className={isFavorite ? "fill-current" : ""} />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col flex-1 p-5">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-widest text-[var(--color-brand)] uppercase">
                                <CalendarIcon size={12} />
                                <span>{format(new Date(event.start_date), "MMM d, yyyy")}</span>
                            </div>
                            <div className="flex items-center gap-1 text-[11px] font-medium text-[var(--color-text-tertiary)]">
                                <Users size={12} />
                                <span>{event.attendee_count}</span>
                            </div>
                        </div>
                        <h3 className="text-lg font-bold text-[var(--color-text-primary)] leading-tight mb-2 line-clamp-1 group-hover:text-[var(--color-brand)] transition-colors">
                            {event.event_name}
                        </h3>
                        <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2 mb-4 flex-1 leading-relaxed">
                            {event.event_description || "Experience an unforgettable event. View full details and the schedule inside."}
                        </p>
                        <div className="flex items-center justify-between pt-4 border-t border-[var(--color-border)] mt-auto">
                            <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)] max-w-[80%]">
                                <MapPin size={14} className="shrink-0 text-[var(--color-brand)]" />
                                <span className="truncate">{event.venue_city || "TBA"}</span>
                            </div>
                            <div className="text-[var(--color-brand)]">
                                <ArrowRight size={18} />
                            </div>
                        </div>
                    </div>
                </article>
            </Link>

            {hasActions && (
                <div className="absolute bottom-[4.5rem] right-3 z-20 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onEdit && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onEdit(event); }}
                            className="p-1.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-brand)] hover:border-[var(--color-brand)] transition-colors shadow-sm"
                            title="Edit event"
                        >
                            <Pencil size={13} />
                        </button>
                    )}
                    {onDelete && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onDelete(event.id!); }}
                            className="p-1.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] hover:border-[var(--color-danger)] transition-colors shadow-sm"
                            title="Delete event"
                        >
                            <Trash2 size={13} />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}