import React from "react";
import { Calendar, Globe, Ticket, Store, LayoutGrid, CalendarDays, Map } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DashboardToolbarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  viewMode: 'grid' | 'calendar' | 'map';
  onViewModeChange: (mode: 'grid' | 'calendar' | 'map') => void;
}

export function DashboardToolbar({
  activeTab,
  onTabChange,
  viewMode,
  onViewModeChange,
}: DashboardToolbarProps) {
  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6 bg-zinc-900/50 backdrop-blur-md rounded-2xl p-2 border border-zinc-800/50 shadow-lg">
      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={onTabChange} className="w-full md:w-auto">
        <TabsList className="bg-zinc-950/50 border border-zinc-800/50 p-1 h-auto w-full md:w-auto flex">
          <TabsTrigger value="my-events" className="flex-1 md:flex-none gap-2 px-4 py-2">
            <Calendar size={16} />
            <span className="hidden sm:inline">My Events</span>
          </TabsTrigger>
          <TabsTrigger value="attending" className="flex-1 md:flex-none gap-2 px-4 py-2">
            <Ticket size={16} />
            <span className="hidden sm:inline">Attending</span>
          </TabsTrigger>
          <TabsTrigger value="discover" className="flex-1 md:flex-none gap-2 px-4 py-2">
            <Globe size={16} />
            <span className="hidden sm:inline">Discover</span>
          </TabsTrigger>
          <TabsTrigger value="find-vendors" className="flex-1 md:flex-none gap-2 px-4 py-2">
            <Store size={16} />
            <span className="hidden sm:inline">Vendors</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* View Mode Toggle - Only show for event lists */}
      {activeTab !== 'find-vendors' && (
        <div className="flex bg-zinc-950/50 rounded-xl p-1 border border-zinc-800/50">
          <button
            onClick={() => onViewModeChange('grid')}
            className={`px-3 py-2 rounded-lg transition-all flex items-center gap-2 ${
              viewMode === 'grid'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
            title="Grid View"
          >
            <LayoutGrid size={16} />
            <span className="text-xs font-medium hidden sm:inline">Grid</span>
          </button>
          <button
            onClick={() => onViewModeChange('calendar')}
            className={`px-3 py-2 rounded-lg transition-all flex items-center gap-2 ${
              viewMode === 'calendar'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
            title="Calendar View"
          >
            <CalendarDays size={16} />
            <span className="text-xs font-medium hidden sm:inline">Calendar</span>
          </button>
          <button
            onClick={() => onViewModeChange('map')}
            className={`px-3 py-2 rounded-lg transition-all flex items-center gap-2 ${
              viewMode === 'map'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
            title="Map View"
          >
            <Map size={16} />
            <span className="text-xs font-medium hidden sm:inline">Map</span>
          </button>
        </div>
      )}
    </div>
  );
}
