"use client";

import { ErrorPage } from "@/components/ui/ErrorPage";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error(props: ErrorProps) {
  return <ErrorPage {...props} />;
}
