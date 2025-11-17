"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function VendorDashboardPage() {
  const router = useRouter();
  const { session, userProfile, loading, signOut } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!session) {
        router.push("/signin");
      } else if (userProfile && userProfile.role !== "vendor") {
        router.push("/customer-dashboard");
      }
    }
  }, [session, userProfile, loading, router]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center">
        <p className="text-gray-800 dark:text-white">Loading...</p>
      </div>
    );
  }

  if (session && !userProfile) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center">
        <p className="text-gray-800 dark:text-white">Loading profile...</p>
      </div>
    );
  }

  if (!session || userProfile?.role !== "vendor") {
    return null;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto border-b border-gray-200 dark:border-zinc-700">
        <button
          onClick={() => router.push("/")}
          className="text-2xl font-bold text-green-700 dark:text-green-500 hover:text-green-800 dark:hover:text-green-400 transition"
        >
          EMS (WIP) - Vendor
        </button>
        <div className="flex items-center gap-4">
          <div className="text-gray-700 dark:text-gray-300 text-sm">
            Welcome, <span className="font-medium">{session.user.email}</span>
          </div>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition flex items-center gap-2"
          >
            <LogOut size={18} />
            Sign Out
          </button>
          <ThemeToggle />
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-6">Vendor Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          You are logged in as a Vendor.
        </p>

        {/* Placeholder Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="p-6 border border-gray-200 dark:border-zinc-700 rounded-lg bg-gray-50 dark:bg-zinc-900/50">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">My Events</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
              Create and manage your events
            </p>
            <button className="w-full px-4 py-2 bg-green-700 dark:bg-green-600 text-white rounded-lg font-medium hover:bg-green-800 dark:hover:bg-green-700 transition">
              Manage Events
            </button>
          </div>

          {/* Card 2 */}
          <div className="p-6 border border-gray-200 dark:border-zinc-700 rounded-lg bg-gray-50 dark:bg-zinc-900/50">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Create New Event
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
              Create a new event listing
            </p>
            <button className="w-full px-4 py-2 bg-green-700 dark:bg-green-600 text-white rounded-lg font-medium hover:bg-green-800 dark:hover:bg-green-700 transition">
              Create Event
            </button>
          </div>

          {/* Card 3 */}
          <div className="p-6 border border-gray-200 dark:border-zinc-700 rounded-lg bg-gray-50 dark:bg-zinc-900/50">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Event Analytics
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
              View event registrations and analytics
            </p>
            <button className="w-full px-4 py-2 bg-green-700 dark:bg-green-600 text-white rounded-lg font-medium hover:bg-green-800 dark:hover:bg-green-700 transition">
              View Analytics
            </button>
          </div>
        </div>

        {/* User Info Card */}
        <div className="mt-8 p-6 border border-gray-200 dark:border-zinc-700 rounded-lg bg-gray-50 dark:bg-zinc-900/50">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Account Information
          </h2>
          <div className="space-y-3 text-gray-600 dark:text-gray-400">
            <p>
              <span className="text-gray-900 dark:text-white font-medium">Email:</span>{" "}
              {session.user.email}
            </p>
            <p>
              <span className="text-gray-900 dark:text-white font-medium">Account Type:</span>{" "}
              <span className="text-green-700 dark:text-green-500">Vendor</span>
            </p>
            <p>
              <span className="text-gray-900 dark:text-white font-medium">User ID:</span>{" "}
              <code className="text-xs bg-gray-200 dark:bg-black/50 px-2 py-1 rounded text-gray-900 dark:text-gray-400">
                {session.user.id}
              </code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
