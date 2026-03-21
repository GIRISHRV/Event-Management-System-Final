"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error("Global Error:", error);
    }
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="bg-[#1a1a1a] text-white">
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center">
            <div className="mb-6">
              <div className="w-16 h-16 bg-red-500/20 rounded-md flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <h1 className="text-2xl font-semibold text-white mb-2">Something Went Wrong</h1>
              <p className="text-gray-400">
                We encountered an unexpected error. Please refresh the page to try again.
              </p>
            </div>

            <button
              onClick={reset}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#2563eb] hover:bg-blue-600 text-white font-medium rounded-md transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh Page
            </button>

            {error.digest && (
              <p className="mt-4 text-xs text-gray-600">
                Error ID: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
