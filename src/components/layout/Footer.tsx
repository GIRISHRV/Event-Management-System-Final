"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export function Footer() {
  const currentYear = new Date().getFullYear();
  const { userProfile } = useAuth();

  const isVendor = userProfile?.role === "vendor";
  const isAdmin = userProfile?.role === "admin";
  
  const dashboardLink = isAdmin ? "/admin-dashboard" : isVendor ? "/vendor-dashboard" : "/customer-dashboard";
  const dashboardName = isAdmin ? "Admin Dashboard" : isVendor ? "Vendor Dashboard" : "Dashboard";

  return (
    <footer className="w-full bg-[var(--color-surface)] border-t border-[var(--color-border)] py-8">
      <div className="max-w-7xl mx-auto px-4 md:px-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-[var(--radius-sm)] bg-[var(--color-brand)] flex items-center justify-center text-white font-bold text-sm">
              E
            </div>
            <span className="font-bold text-lg text-[var(--color-text-primary)] tracking-tight">EventMS</span>
          </Link>
          <nav className="hidden sm:flex items-center gap-6">
            <Link href="/events" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-brand)] transition-colors">Discover</Link>
            <Link href={dashboardLink} className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-brand)] transition-colors">
              {dashboardName}
            </Link>
            <Link href="/profile" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-brand)] transition-colors">Profile</Link>
          </nav>
        </div>

        <div className="flex items-center gap-8">
          <p className="text-xs text-[var(--color-text-tertiary)] font-medium">
            &copy; {currentYear} EventMS. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
