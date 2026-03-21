import { cn } from "@/lib/cn";
import { Badge } from "./Badge";
import { EVENT_STATUS, BOOKING_STATUS } from "@/lib/constants";

export type StatusType = "default" | "success" | "warning" | "danger" | "secondary";

// ─── Event Status Badge ──────────────────────────────────────────────────────

const EVENT_STATUS_MAP: Record<
  string,
  { label: string; variant: "default" | "success" | "warning" | "danger" | "secondary" }
> = {
  [EVENT_STATUS.UPCOMING]: { label: "Upcoming", variant: "default" },
  [EVENT_STATUS.ONGOING]: { label: "Ongoing", variant: "success" },
  [EVENT_STATUS.COMPLETED]: { label: "Completed", variant: "secondary" },
  [EVENT_STATUS.CANCELLED]: { label: "Cancelled", variant: "danger" },
};

interface EventStatusBadgeProps {
  status: string;
  className?: string;
}

export function EventStatusBadge({ status, className }: EventStatusBadgeProps) {
  const config = EVENT_STATUS_MAP[status] ?? {
    label: status,
    variant: "secondary" as const,
  };

  return (
    <Badge variant={config.variant} className={cn("uppercase tracking-wider text-[10px]", className)}>
      {config.label}
    </Badge>
  );
}

// ─── Booking Status Badge ────────────────────────────────────────────────────

const BOOKING_STATUS_MAP: Record<
  string,
  { label: string; variant: "default" | "success" | "warning" | "danger" | "secondary" }
> = {
  [BOOKING_STATUS.CONFIRMED]: { label: "Confirmed", variant: "success" },
  [BOOKING_STATUS.WAITLIST]: { label: "Waitlist", variant: "warning" },
  [BOOKING_STATUS.CANCELLED]: { label: "Cancelled", variant: "danger" },
};

interface BookingStatusBadgeProps {
  status: string;
  className?: string;
}

export function BookingStatusBadge({
  status,
  className,
}: BookingStatusBadgeProps) {
  const config = BOOKING_STATUS_MAP[status] ?? {
    label: status,
    variant: "secondary" as const,
  };

  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}
