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
  const getStockColor = (available: number) => {
    if (available === 0) return "bg-error-muted text-error border-error/20";
    if (available <= 10) return "bg-warning-muted text-warning border-warning/20";
    if (available <= 20) return "bg-info-muted text-info border-info/20";
    return "bg-success-muted text-success border-success/20";
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
              <div
                className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold cursor-help font-mono transition-colors ${getStockColor(loc.available)}`}
              >
                {getLocationLabel(loc.location)}: {loc.available}
              </div>
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
                  <span className={`font-bold ${
                    loc.available === 0 ? "text-error" :
                    loc.available <= 10 ? "text-warning" :
                    loc.available <= 20 ? "text-info" :
                    "text-success"
                  }`}>
                    {loc.available}
                  </span>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  );
}
