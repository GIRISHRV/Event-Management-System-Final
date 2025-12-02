"use client";

export default function SignInLoading() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-full max-w-md p-8">
        {/* Logo Skeleton */}
        <div className="text-center mb-8">
          <div className="h-8 w-32 bg-zinc-800 rounded animate-pulse mx-auto mb-2" />
          <div className="h-5 w-48 bg-zinc-800/50 rounded animate-pulse mx-auto" />
        </div>

        {/* Form Skeleton */}
        <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800">
          <div className="space-y-4">
            {/* Email Field */}
            <div>
              <div className="h-4 w-16 bg-zinc-800/50 rounded animate-pulse mb-2" />
              <div className="h-12 w-full bg-zinc-800 rounded-lg animate-pulse" />
            </div>

            {/* Password Field */}
            <div>
              <div className="h-4 w-20 bg-zinc-800/50 rounded animate-pulse mb-2" />
              <div className="h-12 w-full bg-zinc-800 rounded-lg animate-pulse" />
            </div>

            {/* Button */}
            <div className="h-12 w-full bg-green-600/50 rounded-lg animate-pulse mt-6" />
          </div>

          {/* Divider */}
          <div className="h-4 w-full bg-zinc-800/30 rounded animate-pulse my-6" />

          {/* Sign Up Link */}
          <div className="h-4 w-48 bg-zinc-800/50 rounded animate-pulse mx-auto" />
        </div>
      </div>
    </div>
  );
}
