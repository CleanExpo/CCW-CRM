"use client";

import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function QuotesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Quotes error:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="border-destructive/50 max-w-md">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="rounded-full bg-destructive/10 p-3">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Quotes Error</h2>
              <p className="text-sm text-muted-foreground">
                {error.message || "Failed to load quotes. Please try again."}
              </p>
              {error.digest && (
                <p className="text-xs text-muted-foreground font-mono">
                  Error ID: {error.digest}
                </p>
              )}
            </div>

            <div className="flex gap-3 mt-2">
              <Button onClick={reset} variant="default">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry Quotes
              </Button>
              <Button onClick={() => (window.location.href = "/dashboard")} variant="outline">
                <Home className="h-4 w-4 mr-2" />
                Go to Dashboard
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
