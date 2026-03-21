"use client";

import React from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

interface DashboardShellProps {
  children: React.ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-[var(--color-background)] flex flex-col">
      <Navbar />
      <main className="flex-1 pt-24 pb-12">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}