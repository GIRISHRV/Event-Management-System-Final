"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

export function Drawer({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
  size = "md",
}: DrawerProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {/* Portal ensures the drawer is appended to document.body, avoiding z-index/overflow issues */}
      <Dialog.Portal>

        {/* Backdrop with enter/exit animations */}
        <Dialog.Overlay
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />

        {/* Drawer Panel */}
        <Dialog.Content
          aria-describedby={description ? "drawer-description" : undefined}
          className={cn(
            "fixed z-[101] flex flex-col bg-[var(--color-background)] shadow-2xl overflow-hidden focus:outline-none",
            // Animation timings
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-300",

            // Mobile: Bottom Sheet
            "inset-x-0 bottom-0 max-h-[96dvh] rounded-t-[var(--radius-2xl)] border-t border-[var(--color-border)]",
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",

            // Desktop: Side Drawer
            "sm:bottom-4 sm:top-4 sm:right-4 sm:left-auto sm:mt-0 sm:max-h-none sm:rounded-[var(--radius-xl)] sm:border sm:border-[var(--color-border)]",
            "data-[state=closed]:sm:slide-out-to-right data-[state=open]:sm:slide-in-from-right",

            // Sizes (Desktop only)
            size === "sm" && "sm:w-full sm:max-w-sm",
            size === "md" && "sm:w-full sm:max-w-[var(--drawer-width,28rem)]",
            size === "lg" && "sm:w-full sm:max-w-2xl",
            size === "xl" && "sm:w-full sm:max-w-4xl",
            className
          )}
        >
          {/* Mobile Handle (Visual Only, but cleaner) */}
          <div className="w-full h-6 flex items-center justify-center sm:hidden shrink-0 mt-1" aria-hidden="true">
            <div className="w-12 h-1.5 bg-[var(--color-text-tertiary)] opacity-30 rounded-full" />
          </div>

          {/* Header */}
          {(title || description) && (
            <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-[var(--color-border)] shrink-0">
              <div className="min-w-0">
                {title && (
                  <Dialog.Title className="text-lg font-semibold text-[var(--color-text-primary)] truncate">
                    {title}
                  </Dialog.Title>
                )}
                {description && (
                  <Dialog.Description className="mt-0.5 text-sm text-[var(--color-text-tertiary)]">
                    {description}
                  </Dialog.Description>
                )}
              </div>
              <Dialog.Close className="p-1.5 rounded-[var(--radius-md)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface)] transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
                <X size={18} />
                <span className="sr-only">Close</span>
              </Dialog.Close>
            </div>
          )}

          {/* Body */}
          <div className="flex-1 flex flex-col min-h-0">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
