"use client";

import React from "react";
import { Plus, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Stat {
    label: string;
    value: string | number;
    icon: React.ElementType;
    trend?: string;
}

interface DashboardHeaderProps {
    title: string;
    subtitle?: string;
    stats?: Stat[];
    onPrimaryAction?: () => void;
    primaryActionLabel?: string;
}

export function DashboardHeader({
    title,
    subtitle,
    stats,
    onPrimaryAction,
    primaryActionLabel,
}: DashboardHeaderProps) {
    return (
        <div className="space-y-6 mb-8">
            {/* Top Row: Title & Action */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] text-[var(--color-brand)] uppercase">
                        <span className="opacity-60">Dashboard</span>
                        <span className="opacity-30">/</span>
                        <span>Overview</span>
                    </div>
                    <h1 className="text-3xl font-black text-[var(--color-text-primary)] tracking-tight">
                        {title}
                    </h1>
                    {subtitle && (
                        <p className="text-[var(--color-text-tertiary)] text-sm max-w-md">
                            {subtitle}
                        </p>
                    )}
                </div>

                {onPrimaryAction && (
                    <Button
                        onClick={onPrimaryAction}
                        className="group relative overflow-hidden bg-[var(--color-brand)] hover:bg-[var(--color-brand)]/90 text-white px-6 h-12 rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                    >
                        <span className="relative z-10 flex items-center gap-2 font-bold">
                            <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" />
                            {primaryActionLabel || "Action"}
                        </span>
                        <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                    </Button>
                )}
            </div>

            {/* Bottom Row: Quick Stats Grid */}
            {stats && stats.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {stats.map((stat, i) => {
                        const Icon = stat.icon;
                        return (
                            <div
                                key={i}
                                className="group flex items-center justify-between p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-brand)] transition-all"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-[var(--color-background)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-brand)] group-hover:scale-110 transition-transform">
                                        <Icon size={24} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-tertiary)]">
                                            {stat.label}
                                        </p>
                                        <p className="text-2xl font-black text-[var(--color-text-primary)]">
                                            {stat.value}
                                        </p>
                                    </div>
                                </div>
                                {stat.trend && (
                                    <div className="flex items-center gap-1 text-green-500 bg-green-500/10 px-2 py-1 rounded-full text-[10px] font-bold">
                                        <TrendingUp size={12} />
                                        {stat.trend}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}