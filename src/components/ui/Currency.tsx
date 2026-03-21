/**
 * Shared currency display component
 * Consistent currency formatting across the codebase
 */

import { formatINR } from "@/lib/format";
import { IndianRupee } from "lucide-react";
import { cn } from "@/lib/utils";

interface CurrencyProps {
  amount: number;
  showIcon?: boolean;
  className?: string;
  iconClassName?: string;
  size?: "sm" | "md" | "lg";
}

export function Currency({
  amount,
  showIcon = false,
  className,
  iconClassName,
  size = "md",
}: CurrencyProps) {
  const sizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  const iconSizes = {
    sm: 14,
    md: 16,
    lg: 18,
  };

  return (
    <span className={cn("inline-flex items-center gap-1 font-semibold", sizeClasses[size], className)}>
      {showIcon && (
        <IndianRupee
          size={iconSizes[size]}
          className={cn("text-current", iconClassName)}
        />
      )}
      <span>{formatINR(amount)}</span>
    </span>
  );
}
