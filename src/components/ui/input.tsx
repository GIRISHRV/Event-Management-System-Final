"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
  leftIcon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, label, leftIcon, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-2.5 text-[var(--color-text-tertiary)] pointer-events-none">
              {leftIcon}
            </div>
          )}
          <input
            type={type}
            id={inputId}
            className={cn(
              "flex h-9 w-full rounded-[var(--radius-md)] bg-[var(--color-input)] border px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-input-placeholder)] transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
              leftIcon && "pl-10",
              error
                ? "border-[var(--color-danger)] focus-visible:ring-1 focus-visible:ring-[var(--color-danger)]"
                : "border-[var(--color-input-border)] focus-visible:border-[var(--color-input-focus)] focus-visible:ring-1 focus-visible:ring-[var(--color-input-focus)]",
              className
            )}
            ref={ref}
            {...props}
          />
        </div>
        {error && (
          <p className="mt-1 text-xs text-[var(--color-danger)]">{error}</p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
