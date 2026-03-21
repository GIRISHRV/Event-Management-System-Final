"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

// ─── Tabs Root ───────────────────────────────────────────────────────────────

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabs() {
  const context = React.useContext(TabsContext);
  if (!context) throw new Error("Tabs components must be used within <Tabs>");
  return context;
}

interface TabsProps {
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

function Tabs({
  defaultValue,
  value,
  onValueChange,
  children,
  className,
}: TabsProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const activeTab = value ?? internalValue;

  const setActiveTab = React.useCallback(
    (newValue: string) => {
      if (onValueChange) {
        onValueChange(newValue);
      } else {
        setInternalValue(newValue);
      }
    },
    [onValueChange]
  );

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={cn("w-full", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

// ─── Tab List ────────────────────────────────────────────────────────────────

interface TabListProps {
  children: React.ReactNode;
  className?: string;
}

function TabList({ children, className }: TabListProps) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex items-center gap-1 border-b border-[var(--color-border)] pb-px",
        className
      )}
    >
      {children}
    </div>
  );
}

// ─── Tab Trigger ─────────────────────────────────────────────────────────────

interface TabTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

function TabTrigger({ value, children, className, disabled }: TabTriggerProps) {
  const { activeTab, setActiveTab } = useTabs();
  const isActive = activeTab === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      disabled={disabled}
      onClick={() => setActiveTab(value)}
      className={cn(
        "relative px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] rounded-[var(--radius-sm)]",
        isActive
          ? "text-[var(--color-brand)]"
          : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {children}
      {isActive && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-brand)] rounded-full" />
      )}
    </button>
  );
}

// ─── Tab Content ─────────────────────────────────────────────────────────────

interface TabContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

function TabContent({ value, children, className }: TabContentProps) {
  const { activeTab } = useTabs();
  if (activeTab !== value) return null;

  return (
    <div role="tabpanel" className={cn("mt-4", className)}>
      {children}
    </div>
  );
}

export {
  Tabs,
  TabList,
  TabTrigger,
  TabContent,
  TabList as TabsList,
  TabTrigger as TabsTrigger,
  TabContent as TabsContent,
};
