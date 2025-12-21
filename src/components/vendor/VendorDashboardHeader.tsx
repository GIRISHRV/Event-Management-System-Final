import React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VendorDashboardHeaderProps {
  activeTab: string;
  onCreateService: () => void;
}

export function VendorDashboardHeader({ activeTab, onCreateService }: VendorDashboardHeaderProps) {
  const getTitle = () => {
    switch (activeTab) {
      case "services":
        return "My Services";
      case "requests":
        return "Service Requests";
      default:
        return "Vendor Dashboard";
    }
  };

  const getDescription = () => {
    switch (activeTab) {
      case "services":
        return "Manage the services you offer to event organizers";
      case "requests":
        return "View and respond to incoming service requests";
      default:
        return "Manage your vendor activities";
    }
  };

  return (
    <div className="flex items-center justify-between mb-8 bg-zinc-950/90 backdrop-blur-sm rounded-xl p-6 border border-zinc-700">
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">{getTitle()}</h1>
        <p className="text-gray-400">{getDescription()}</p>
      </div>
      {activeTab === "services" && (
        <Button
          onClick={onCreateService}
          className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
        >
          <Plus size={20} />
          Create Service
        </Button>
      )}
    </div>
  );
}
