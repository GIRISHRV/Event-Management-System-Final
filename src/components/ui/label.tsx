"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/cn";

const Label = React.forwardRef<
  React.ComponentRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & {
    required?: boolean;
  }
>(({ className, required, children, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      "text-sm font-medium text-[var(--color-text-secondary)] leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
      className
    )}
    {...props}
  >
    {children}
    {required && (
      <span className="text-[var(--color-danger)] ml-0.5" aria-hidden="true">
        *
      </span>
    )}
  </LabelPrimitive.Root>
));
Label.displayName = "Label";

export { Label };
