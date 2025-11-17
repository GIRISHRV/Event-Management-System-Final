"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseAuth } from "@/hooks/useSupabase";
import { LogOut } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const { session, loading, signOut } = useSupabaseAuth();

  useEffect(() => {
    if (!loading && !session) {
      router.push("/signin");
    }
  }, [session, loading, router]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-black via-zinc-900 to-black flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-black via-zinc-900 to-black">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto border-b border-zinc-700">
        <div className="text-2xl font-bold text-white">EMS (WIP) Dashboard</div>
        <div className="flex items-center gap-4">
          <div className="text-white text-sm">
            Welcome, <span className="font-medium">{session.user.email}</span>
          </div>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition flex items-center gap-2"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold text-white mb-6">Dashboard</h1>
        <p className="text-zinc-400 mb-8">
          You are successfully signed in!
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* User Info Card */}
          <div className="p-6 border border-zinc-700 rounded-lg bg-zinc-900/50">
            <h2 className="text-xl font-semibold text-white mb-4">
              Account Information
            </h2>
            <div className="space-y-3 text-zinc-400">
              <p>
                <span className="text-white font-medium">Email:</span>{" "}
                {session.user.email}
              </p>
              <p>
                <span className="text-white font-medium">User ID:</span>{" "}
                <code className="text-xs bg-black/50 px-2 py-1 rounded">
                  {session.user.id}
                </code>
              </p>
              <p>
                <span className="text-white font-medium">User Status:</span>{" "}
                Active
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="p-6 border border-zinc-700 rounded-lg bg-zinc-900/50">
            <h2 className="text-xl font-semibold text-white mb-4">
              Quick Actions
            </h2>
            <div className="space-y-2">
              <button className="w-full px-4 py-2 bg-white text-black rounded-lg font-medium hover:bg-zinc-100 transition">
                Edit Profile
              </button>
              <button className="w-full px-4 py-2 border border-white text-white rounded-lg font-medium hover:bg-white/10 transition">
                Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
