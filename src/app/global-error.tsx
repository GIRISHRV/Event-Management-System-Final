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
      <body className="bg-zinc-950 text-white">
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center">
            <div className="mb-6">
              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-10 h-10 text-red-500" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">Critical Error</h1>
              <p className="text-zinc-400">
                Something went seriously wrong. Please refresh the page.
              </p>
            </div>

            <button
              onClick={reset}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors text-lg"
            >
              <RefreshCw className="w-5 h-5" />
              Refresh Page
            </button>

            {error.digest && (
              <p className="mt-6 text-xs text-zinc-600">
                Error ID: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
