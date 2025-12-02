"use client";

import Link from "next/link";
import { Home, ArrowLeft, Calendar } from "lucide-react";
import { useRouter } from "next/navigation";
import Squares from "@/components/ui/Squares";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-zinc-950 relative overflow-hidden flex items-center justify-center">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <Squares
          speed={0.3}
          squareSize={40}
          direction="diagonal"
          borderColor="rgba(34, 197, 94, 0.1)"
          hoverFillColor="rgba(34, 197, 94, 0.05)"
        />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-2xl mx-auto">
        {/* 404 Number */}
        <div className="mb-8">
          <h1 className="text-[150px] md:text-[200px] font-bold text-transparent bg-clip-text bg-linear-to-b from-green-400 to-green-600/20 leading-none select-none">
            404
          </h1>
        </div>

        {/* Message */}
        <div className="space-y-4 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white">
            Page Not Found
          </h2>
          <p className="text-zinc-400 text-lg max-w-md mx-auto">
            The page you&apos;re looking for doesn&apos;t exist or has been moved. 
            Let&apos;s get you back on track.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl transition-all duration-200 border border-zinc-700 hover:border-zinc-600 w-full sm:w-auto justify-center"
          >
            <ArrowLeft size={20} />
            Go Back
          </button>
          
          <Link
            href="/"
            className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-all duration-200 w-full sm:w-auto justify-center"
          >
            <Home size={20} />
            Back to Home
          </Link>
        </div>

        {/* Quick Links */}
        <div className="mt-16 pt-8 border-t border-zinc-800">
          <p className="text-zinc-500 text-sm mb-4">Or try these popular pages:</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/signin"
              className="text-green-500 hover:text-green-400 transition-colors text-sm font-medium"
            >
              Sign In
            </Link>
            <span className="text-zinc-700">•</span>
            <Link
              href="/signup"
              className="text-green-500 hover:text-green-400 transition-colors text-sm font-medium"
            >
              Create Account
            </Link>
            <span className="text-zinc-700">•</span>
            <Link
              href="/customer-dashboard"
              className="text-green-500 hover:text-green-400 transition-colors text-sm font-medium flex items-center gap-1"
            >
              <Calendar size={14} />
              Browse Events
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
