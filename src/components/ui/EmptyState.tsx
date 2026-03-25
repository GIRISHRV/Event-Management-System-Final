import { cn } from "@/lib/cn";
import { type LucideIcon } from "lucide-react";
import { Button } from "./button";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  // action?: any; // For backward compatibility (Removing to fix lint)
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 text-center",
        className
      )}
    >
      {Icon && (
        <div className="mb-4 rounded-full bg-[var(--color-surface)] p-4">
          <Icon className="w-8 h-8 text-[var(--color-text-muted)]" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-[var(--color-text-tertiary)] max-w-sm mb-4">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button variant="primary" size="md" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
