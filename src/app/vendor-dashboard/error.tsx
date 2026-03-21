"use client";

import { ErrorPage } from "@/components/ui/ErrorPage";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function VendorDashboardError(props: ErrorProps) {
  return <ErrorPage {...props} title="Vendor Dashboard Error" />;
}
