"use client";

/**
 * Network Error UI Component
 *
 * Displays when network connection is lost or API is unreachable.
 */

import { WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface NetworkErrorProps {
  onRetry?: () => void;
  message?: string;
}

export function NetworkError({ onRetry, message }: NetworkErrorProps) {
  return (
    <Alert variant="destructive">
      <WifiOff className="h-4 w-4" />
      <AlertTitle>Network Error</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>
          {message || "Unable to connect to the server. Please check your internet connection."}
        </span>
        {onRetry && (
          <Button onClick={onRetry} variant="outline" size="sm" className="ml-4">
            <RefreshCw className="mr-2 h-3 w-3" />
            Retry
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Inline network error (for use in components)
 */
export function InlineNetworkError({ onRetry }: Pick<NetworkErrorProps, "onRetry">) {
  return (
    <div className="flex items-center justify-center p-8 text-center">
      <div className="space-y-4">
        <div className="flex justify-center">
          <WifiOff className="h-12 w-12 text-muted-foreground" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Connection Lost</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Unable to fetch data. Please check your connection.
          </p>
        </div>
        {onRetry && (
          <Button onClick={onRetry} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        )}
      </div>
    </div>
  );
}
