"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X, Search, Store, LayoutDashboard, Calendar, User, LogOut, Shield } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";

export function Navbar() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { session, userProfile, signOut } = useAuth();

  const isVendor = userProfile?.role === 'vendor';
  const isAdmin = userProfile?.role === 'admin';

  const NAV_LINKS = [
    { name: "Discover", href: "/events", icon: Search },
    ...(isAdmin
      ? [{ name: "Admin Dashboard", href: "/admin-dashboard", icon: Shield }]
      : isVendor
      ? [{ name: "Vendor Dashboard", href: "/vendor-dashboard", icon: Store }]
      : [{ name: "My Dashboard", href: "/customer-dashboard", icon: LayoutDashboard }]
    ),
  ];

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-300",
        isScrolled
          ? "bg-[var(--color-background)]/80 backdrop-blur-md border-b border-[var(--color-border)] shadow-sm py-3"
          : "bg-transparent py-5"
      )}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">

        <Link
          href="/"
          className="flex items-center gap-2 group transition-transform hover:scale-[1.02] active:scale-95"
        >
          <div className="w-8 h-8 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center shadow-sm group-hover:border-[var(--color-brand)] transition-colors">
            <Calendar className="text-[var(--color-brand)] w-4 h-4" />
          </div>
          <span className="text-xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Event<span className="text-[var(--color-brand)]"> MS</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className="relative px-4 py-2 text-sm font-medium transition-colors rounded-full group"
              >
                <span className={cn(
                  "relative z-10 transition-colors duration-200",
                  isActive
                    ? "text-[var(--color-brand)]"
                    : "text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]"
                )}>
                  {link.name}
                </span>
                {isActive && (
                  <div className="absolute inset-0 bg-[var(--color-brand)]/10 rounded-full animate-in zoom-in-95 duration-200 -z-0" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {session ? (
            <>
              <Link href="/profile">
                <Button variant="ghost" size="sm" className="rounded-full w-9 h-9 p-0 flex items-center justify-center border border-[var(--color-border)] hover:bg-[var(--color-surface)]">
                  <User size={16} className="text-[var(--color-text-secondary)]" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut()}
                className="rounded-full w-9 h-9 p-0 text-[var(--color-text-tertiary)] hover:text-red-400 hover:bg-red-400/10 transition-colors"
                aria-label="Sign out"
              >
                <LogOut size={16} />
              </Button>
            </>
          ) : (
            <>
              <Link href="/signin">
                <Button variant="ghost" size="sm" className="px-4">Sign In</Button>
              </Link>
              <Link href="/signup">
                <Button variant="primary" size="sm" className="px-4">Get Started</Button>
              </Link>
            </>
          )}
        </div>

        <Dialog.Root open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <Dialog.Trigger asChild>
            <button className="md:hidden p-2 -mr-2 text-[var(--color-text-primary)] hover:bg-[var(--color-surface)] rounded-full transition-colors focus:outline-none">
              <Menu size={24} />
            </button>
          </Dialog.Trigger>

          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

            <Dialog.Content
              aria-describedby={undefined}
              className="fixed inset-y-0 right-0 z-[101] w-full max-w-[280px] bg-[var(--color-background)] shadow-2xl border-l border-[var(--color-border)] p-6 flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right duration-300 focus:outline-none"
            >
              <div className="flex items-center justify-between mb-8">
                <Dialog.Title className="text-lg font-bold text-[var(--color-text-primary)]">
                  Menu
                </Dialog.Title>
                <Dialog.Description className="sr-only">
                  Navigation menu
                </Dialog.Description>
                <Dialog.Close className="p-2 -mr-2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface)] rounded-full transition-colors focus:outline-none">
                  <X size={20} />
                  <span className="sr-only">Close menu</span>
                </Dialog.Close>
              </div>

              <nav className="flex flex-col gap-2 flex-1">
                {NAV_LINKS.map((link) => {
                  const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-[var(--radius-lg)] text-sm font-medium transition-all",
                        isActive
                          ? "bg-[var(--color-brand)]/10 text-[var(--color-brand)]"
                          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)]"
                      )}
                    >
                      <Icon size={18} className={isActive ? "text-[var(--color-brand)]" : "text-[var(--color-text-tertiary)]"} />
                      {link.name}
                    </Link>
                  );
                })}
              </nav>

              <div className="mt-auto pt-6 border-t border-[var(--color-border)] space-y-3">
                {session ? (
                  <>
                    <Link href="/profile" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button variant="outline" className="w-full justify-start gap-2">
                        <User size={16} />
                        My Profile
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      onClick={() => { signOut(); setIsMobileMenuOpen(false); }}
                      className="w-full justify-start gap-2 text-red-400 hover:text-red-500 hover:bg-red-400/10"
                    >
                      <LogOut size={16} />
                      Sign Out
                    </Button>
                  </>
                ) : (
                  <>
                    <Link href="/signin" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button variant="outline" className="w-full justify-start">Sign In</Button>
                    </Link>
                    <Link href="/signup" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button variant="primary" className="w-full justify-start">Get Started</Button>
                    </Link>
                  </>
                )}
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </header>
  );
}