import React from "react";
import { Calendar, Globe, Store, LayoutGrid, CalendarDays, Map, Briefcase, Inbox, Ticket, Sparkles, Star } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";

type ViewMode = "grid" | "calendar" | "map";

export interface DashboardTabDef {
    value: string;
    label: string;
    icon: React.ElementType;
}

export interface DashboardToolbarProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
    tabs?: DashboardTabDef[];
    /** Pass viewMode + onViewModeChange only if view switching is needed */
    viewMode?: ViewMode;
    onViewModeChange?: (mode: ViewMode) => void;
    /** Tabs where the view-mode switcher should be HIDDEN */
    hideViewFor?: string[];
    /** Tailwind classes for active tab highlight (default: zinc) */
    activeTabClass?: string;
    /**
     * "horizontal" (default) = top tab bar used in dashboard body
     * "sidebar" = left vertical nav used in the new sidebar layout
     */
    variant?: "horizontal" | "sidebar";
    /** Show Upgrade Plan card at bottom of sidebar */
    showUpgrade?: boolean;
}

export const CUSTOMER_TABS: DashboardTabDef[] = [
    { value: "my-events", label: "My Events", icon: Calendar },
    { value: "bookings", label: "My Bookings", icon: Ticket },
    { value: "inquiries", label: "Inquiries", icon: Inbox },
    { value: "discover", label: "Discover", icon: Globe },
    { value: "vendors", label: "Vendors", icon: Store },
    { value: "pro-team", label: "Pro Team", icon: Briefcase },
];

export const VENDOR_TABS: DashboardTabDef[] = [
    { value: "services", label: "My Services", icon: Briefcase },
    { value: "requests", label: "Service Requests", icon: Inbox },
    { value: "ratings", label: "My Ratings", icon: Star },
    { value: "insights", label: "AI Insights", icon: Sparkles },
];

export function DashboardToolbar({
    activeTab,
    onTabChange,
    tabs = CUSTOMER_TABS,
    viewMode,
    onViewModeChange,
    hideViewFor = [],
    activeTabClass = "",
    variant = "horizontal",
    showUpgrade = false,
}: DashboardToolbarProps) {
    // ── Sidebar variant ──────────────────────────────────────────────────────
    if (variant === "sidebar") {
        return (
            <aside className="w-64 bg-[var(--color-background)] border-r border-[var(--color-border)] hidden lg:flex flex-col py-6 px-4 shrink-0">
                <div className="flex-1">
                    <p className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-3 px-2">Menu</p>
                    <nav className="space-y-1">
                        {tabs.map(({ value, label, icon: Icon }) => {
                            const isActive = activeTab === value;
                            return (
                                <button
                                    key={value}
                                    onClick={() => onTabChange(value)}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${isActive
                                            ? "bg-[var(--color-brand)]/15 text-[var(--color-brand)]"
                                            : "text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)]"
                                        }`}
                                >
                                    <Icon size={16} strokeWidth={isActive ? 2.5 : 1.75} />
                                    {label}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Upgrade Plan card */}
                {showUpgrade && (
                    <div className="mt-auto px-1">
                        <div className="relative p-4 rounded-lg bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-background)] border border-[var(--color-border)] overflow-hidden">
                            <div className="absolute -top-6 -right-6 w-20 h-20 bg-[var(--color-brand)]/20 rounded-full blur-2xl pointer-events-none" />
                            <h4 className="font-semibold text-sm text-white mb-1 relative z-10">Upgrade Plan</h4>
                            <p className="text-xs text-[var(--color-text-tertiary)] mb-3 relative z-10">Get more features for your events.</p>
                            <Link
                                href="#"
                                className="text-xs bg-[var(--color-brand)] hover:bg-[var(--color-brand)]/90 px-3 py-1.5 rounded text-white font-medium transition-colors relative z-10 inline-block"
                            >
                                View Plans
                            </Link>
                        </div>
                    </div>
                )}
            </aside>
        );
    }

    // ── Horizontal (original) variant ────────────────────────────────────────
    const showViewToggle =
        !!viewMode &&
        !!onViewModeChange &&
        !hideViewFor.includes(activeTab);

    return (
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 mb-4 bg-[var(--color-surface)] rounded-lg p-1.5 border border-[var(--color-border)]">
            <Tabs value={activeTab} defaultValue={activeTab} onValueChange={onTabChange} className="w-full md:w-auto">
                <TabsList className="bg-[var(--color-background)] border border-[var(--color-border)] p-1 h-auto w-full md:w-auto flex">
                    {tabs.map(({ value, label, icon: Icon }) => (
                        <TabsTrigger
                            key={value}
                            value={value}
                            className={`flex-1 md:flex-none gap-2 px-3 py-2 ${activeTabClass}`}
                        >
                            <Icon size={14} />
                            <span className="hidden sm:inline text-sm">{label}</span>
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>

            {showViewToggle && (
                <div className="flex bg-[var(--color-background)] rounded-lg p-1 border border-[var(--color-border)]">
                    {(
                        [
                            { mode: "grid" as ViewMode, Icon: LayoutGrid, label: "Grid" },
                            { mode: "calendar" as ViewMode, Icon: CalendarDays, label: "Calendar" },
                            { mode: "map" as ViewMode, Icon: Map, label: "Map" },
                        ] as const
                    ).map(({ mode, Icon, label }) => (
                        <button
                            key={mode}
                            onClick={() => onViewModeChange!(mode)}
                            title={`${label} View`}
                            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-2 ${viewMode === mode
                                    ? "bg-[var(--color-surface)] text-white"
                                    : "text-[var(--color-text-tertiary)] hover:text-zinc-200 hover:bg-[var(--color-surface)]/50"
                                }`}
                        >
                            <Icon size={14} />
                            <span className="text-xs font-medium hidden sm:inline">{label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
