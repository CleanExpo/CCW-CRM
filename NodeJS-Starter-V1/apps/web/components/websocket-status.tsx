/**
 * WebSocket Connection Status Indicator
 *
 * Visual indicator showing the current WebSocket connection state.
 * Can be placed in navbar or footer.
 */

"use client";

import { useWebSocketContext } from "@/contexts/websocket-context";
import { cn } from "@/lib/utils";
import { Wifi, WifiOff, Loader2, AlertCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface WebSocketStatusProps {
  /** Show label text (default: false for compact mode) */
  showLabel?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Custom className */
  className?: string;
}

export function WebSocketStatus({
  showLabel = false,
  size = "sm",
  className,
}: WebSocketStatusProps) {
  const { connectionState, lastError } = useWebSocketContext();

  const sizeClasses = {
    sm: "h-2 w-2",
    md: "h-3 w-3",
    lg: "h-4 w-4",
  };

  const iconSizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const getStatusConfig = () => {
    switch (connectionState) {
      case "connected":
        return {
          label: "Connected",
          description: "Real-time updates active",
          icon: Wifi,
          dotClass: "bg-green-500",
          containerClass: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800",
        };
      case "connecting":
        return {
          label: "Connecting",
          description: "Establishing connection...",
          icon: Loader2,
          dotClass: "bg-yellow-500 animate-pulse",
          containerClass: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800",
        };
      case "disconnected":
        return {
          label: "Disconnected",
          description: "Real-time updates paused",
          icon: WifiOff,
          dotClass: "bg-gray-500",
          containerClass: "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-800",
        };
      case "error":
        return {
          label: "Error",
          description: lastError?.message || "Connection error",
          icon: AlertCircle,
          dotClass: "bg-red-500",
          containerClass: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800",
        };
    }
  };

  const status = getStatusConfig();
  const Icon = status.icon;

  const content = (
    <div
      className={cn(
        "flex items-center gap-2 px-2.5 py-1.5 rounded-full border text-xs font-medium transition-colors",
        status.containerClass,
        className
      )}
    >
      <div className={cn("rounded-full", sizeClasses[size], status.dotClass)} />
      {showLabel && (
        <>
          <Icon
            className={cn(
              iconSizeClasses[size],
              connectionState === "connecting" && "animate-spin"
            )}
          />
          <span>{status.label}</span>
        </>
      )}
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {content}
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-center">
            <p className="font-semibold">{status.label}</p>
            <p className="text-xs text-muted-foreground">{status.description}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
