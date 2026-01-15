"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface StockByLocation {
  location: string;
  stock: number;
  reserved: number;
  available: number;
}

interface MultiLocationStockCellProps {
  productId: string;
  locations: StockByLocation[];
}

export function MultiLocationStockCell({ productId, locations }: MultiLocationStockCellProps) {
  const getStockColor = (available: number): "default" | "destructive" | "secondary" | "outline" => {
    if (available === 0) return "destructive";
    if (available <= 10) return "outline";
    return "secondary";
  };

  const getLocationLabel = (location: string) => {
    const labels: Record<string, string> = {
      brisbane: "BNE",
      sydney: "SYD",
      melbourne: "MEL",
    };
    return labels[location.toLowerCase()] || location.charAt(0).toUpperCase();
  };

  // Sort locations: Brisbane, Sydney, Melbourne
  const sortedLocations = [...locations].sort((a, b) => {
    const order = ["brisbane", "sydney", "melbourne"];
    return order.indexOf(a.location.toLowerCase()) - order.indexOf(b.location.toLowerCase());
  });

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {sortedLocations.map((loc) => (
        <TooltipProvider key={loc.location}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant={getStockColor(loc.available)}
                className="cursor-help font-mono text-xs"
              >
                {getLocationLabel(loc.location)}: {loc.available}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-sm space-y-1">
                <p className="font-semibold capitalize">{loc.location}</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <span className="text-muted-foreground">On Hand:</span>
                  <span className="font-medium">{loc.stock}</span>
                  <span className="text-muted-foreground">Reserved:</span>
                  <span className="font-medium">{loc.reserved}</span>
                  <span className="text-muted-foreground">Available:</span>
                  <span className="font-medium text-green-600">{loc.available}</span>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  );
}
