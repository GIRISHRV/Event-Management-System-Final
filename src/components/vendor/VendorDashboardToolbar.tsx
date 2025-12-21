import React from "react";
import { Briefcase, Inbox } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface VendorDashboardToolbarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function VendorDashboardToolbar({
  activeTab,
  onTabChange,
}: VendorDashboardToolbarProps) {
  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6 bg-zinc-900/50 backdrop-blur-md rounded-2xl p-2 border border-zinc-800/50 shadow-lg">
      <Tabs value={activeTab} onValueChange={onTabChange} className="w-full md:w-auto">
        <TabsList className="bg-zinc-950/50 border border-zinc-800/50 p-1 h-auto w-full md:w-auto flex">
          <TabsTrigger value="services" className="flex-1 md:flex-none gap-2 px-4 py-2 data-[state=active]:bg-indigo-600/20 data-[state=active]:text-indigo-400 data-[state=active]:border-indigo-500/30">
            <Briefcase size={18} />
            <span className="hidden sm:inline">My Services</span>
          </TabsTrigger>
          <TabsTrigger value="requests" className="flex-1 md:flex-none gap-2 px-4 py-2 data-[state=active]:bg-indigo-600/20 data-[state=active]:text-indigo-400 data-[state=active]:border-indigo-500/30">
            <Inbox size={18} />
            <span className="hidden sm:inline">Service Requests</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
