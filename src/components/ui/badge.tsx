import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-[var(--radius-full)] px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--color-brand-muted)] text-[var(--color-brand)] border border-[var(--color-brand)]/20",
        success:
          "bg-[var(--color-success-muted)] text-[var(--color-success)] border border-[var(--color-success)]/20",
        warning:
          "bg-[var(--color-warning-muted)] text-[var(--color-warning)] border border-[var(--color-warning)]/20",
        danger:
          "bg-[var(--color-danger-muted)] text-[var(--color-danger)] border border-[var(--color-danger)]/20",
        info:
          "bg-[var(--color-info-muted)] text-[var(--color-info)] border border-[var(--color-info)]/20",
        secondary:
          "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
