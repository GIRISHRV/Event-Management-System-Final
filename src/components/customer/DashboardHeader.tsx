import React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardHeaderProps {
  activeTab: string;
  onCreateEvent: () => void;
}

export function DashboardHeader({ activeTab, onCreateEvent }: DashboardHeaderProps) {
  const getTitle = () => {
    switch (activeTab) {
      case "my-events":
        return "My Events";
      case "attending":
        return "Attending";
      case "discover":
        return "Discover Events";
      case "find-vendors":
        return "Find Vendors";
      default:
        return "Dashboard";
    }
  };

  const getDescription = () => {
    switch (activeTab) {
      case "my-events":
        return "Create and manage your events";
      case "attending":
        return "Events you have RSVP'd to";
      case "discover":
        return "Discover and RSVP to public events";
      case "find-vendors":
        return "Find the best vendors for your events";
      default:
        return "Manage your event activities";
    }
  };

  return (
    <div className="flex items-center justify-between mb-8 bg-zinc-950/90 backdrop-blur-sm rounded-xl p-6 border border-zinc-700">
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">{getTitle()}</h1>
        <p className="text-gray-400">{getDescription()}</p>
      </div>
      {activeTab === "my-events" && (
        <Button
          onClick={onCreateEvent}
          className="bg-green-600 hover:bg-green-700 text-white gap-2"
        >
          <Plus size={20} />
          Create Event
        </Button>
      )}
    </div>
  );
}
