"use client";

import { ErrorPage } from "@/components/ui/ErrorPage";
import { ArrowLeft } from "lucide-react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function EventError(props: ErrorProps) {
  return (
    <ErrorPage
      {...props}
      title="Event Error"
      backLink="/customer-dashboard"
      backLabel="Back to Dashboard"
      backIcon={ArrowLeft}
    />
  );
}
