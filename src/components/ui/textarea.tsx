"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  label?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, label, id, ...props }, ref) => {
    const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5"
          >
            {label}
          </label>
        )}
        <textarea
          id={textareaId}
          className={cn(
            "flex min-h-[80px] w-full rounded-[var(--radius-md)] bg-[var(--color-input)] border px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-input-placeholder)] transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 resize-y",
            error
              ? "border-[var(--color-danger)] focus-visible:ring-1 focus-visible:ring-[var(--color-danger)]"
              : "border-[var(--color-input-border)] focus-visible:border-[var(--color-input-focus)] focus-visible:ring-1 focus-visible:ring-[var(--color-input-focus)]",
            className
          )}
          ref={ref}
          {...props}
        />
        {error && (
          <p className="mt-1 text-xs text-[var(--color-danger)]">{error}</p>
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
