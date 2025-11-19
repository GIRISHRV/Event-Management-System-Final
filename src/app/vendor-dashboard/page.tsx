"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";
import PillNav from "@/components/PillNav";

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
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
      </div>
    );
  }

  if (session && !userProfile) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
      </div>
    );
  }

  if (!session || userProfile?.role !== "vendor") {
    return null;
  }

  const navItems = [
    { label: 'Home', href: '/' },
    { label: 'Dashboard', href: '/vendor-dashboard' }
  ];

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Navigation */}
      <PillNav
        items={navItems}
        activeHref="/vendor-dashboard"
        userEmail={session?.user?.email}
        onSignOut={handleSignOut}
        showAuth={true}
      />

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-12 pt-24">
        <h1 className="text-4xl font-bold text-white mb-6">Vendor Dashboard</h1>
        <p className="text-gray-400 mb-8">
          You are logged in as a Vendor.
        </p>

        <div className="p-6 border border-zinc-700/50 rounded-xl bg-zinc-900/60 backdrop-blur-md shadow-lg text-center">
          <h2 className="text-xl font-semibold text-white mb-4">
            Coming Soon
          </h2>
          <p className="text-gray-400">
            The vendor dashboard features are currently under development.
          </p>
        </div>

        {/* User Info Card */}
        <div className="mt-8 p-6 border border-zinc-700/50 rounded-xl bg-zinc-900/60 backdrop-blur-md shadow-lg">
          <h2 className="text-xl font-semibold text-white mb-4">
            Account Information
          </h2>
          <div className="space-y-3 text-gray-400">
            <p>
              <span className="text-white font-medium">Email:</span> {session.user.email}
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
