/**
 * PHASE 4: Real-Time Connection Indicator
 *
 * Shows connection status for SSE streams.
 * Green dot = connected, Gray = disconnected, Red = error
 */

import { Wifi, WifiOff, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface RealTimeIndicatorProps {
  status: "connecting" | "connected" | "disconnected" | "error";
  messagesReceived?: number;
}

export function RealTimeIndicator({ status, messagesReceived = 0 }: RealTimeIndicatorProps) {
  const getStatusConfig = () => {
    switch (status) {
      case "connected":
        return {
          icon: Wifi,
          label: "Live",
          color: "bg-green-500",
          textColor: "text-green-700",
          tooltip: `Connected - ${messagesReceived} updates received`,
        };
      case "connecting":
        return {
          icon: Wifi,
          label: "Connecting...",
          color: "bg-yellow-500 animate-pulse",
          textColor: "text-yellow-700",
          tooltip: "Connecting to real-time updates...",
        };
      case "error":
        return {
          icon: AlertCircle,
          label: "Error",
          color: "bg-red-500",
          textColor: "text-red-700",
          tooltip: "Connection error - will retry automatically",
        };
      case "disconnected":
      default:
        return {
          icon: WifiOff,
          label: "Offline",
          color: "bg-gray-400",
          textColor: "text-gray-700",
          tooltip: "Not connected to real-time updates",
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`flex items-center gap-1.5 ${config.textColor} border-${status === "connected" ? "green" : status === "error" ? "red" : "gray"}-300`}
          >
            <div className={`w-2 h-2 rounded-full ${config.color}`} />
            <Icon className="w-3 h-3" />
            <span className="text-xs font-medium">{config.label}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{config.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
