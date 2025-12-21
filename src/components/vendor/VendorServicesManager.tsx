    "use client";

import { VendorService } from "@/lib/supabase-types";
import { Edit, Trash2, Briefcase } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/button";

interface VendorServicesManagerProps {
  services: VendorService[];
  isLoading: boolean;
  onDelete: (id: string) => void;
  onEdit: (service: VendorService) => void;
}

export default function VendorServicesManager({ services, isLoading, onDelete, onEdit }: VendorServicesManagerProps) {
  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-6 space-y-4">
            <div className="flex justify-between items-start">
              <Skeleton className="h-6 w-24 rounded-full" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
            </div>
            <Skeleton className="h-6 w-3/4 rounded" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-2/3 rounded" />
            <Skeleton className="h-8 w-20 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <EmptyState
        icon={Briefcase}
        title="No services listed yet"
        description="Add your first service to start receiving requests from event organizers!"
      />
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {services.map((service) => (
        <Card key={service.id} className="group relative hover:border-indigo-500/30 transition-all duration-300">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-start mb-2">
              <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border-indigo-500/20">
                {service.category}
              </Badge>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(service)}
                  className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-800"
                  title="Edit Service"
                >
                  <Edit size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(service.id)}
                  className="h-8 w-8 text-zinc-400 hover:text-destructive hover:bg-destructive/10"
                  title="Delete Service"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
            <h3 className="text-lg font-semibold text-white line-clamp-1" title={service.service_name}>
              {service.service_name}
            </h3>
          </CardHeader>
          
          <CardContent className="pb-3">
            <p className="text-zinc-400 text-sm line-clamp-3 min-h-15">
              {service.description}
            </p>
          </CardContent>
          
          <CardFooter className="pt-3 border-t border-zinc-800/50">
            <div className="flex items-baseline gap-1 text-white">
              <span className="text-sm text-zinc-500 font-medium">Starting at</span>
              <span className="text-xl font-bold text-indigo-400">${service.base_price}</span>
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
