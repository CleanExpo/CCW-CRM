"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Portal error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h2 className="text-xl font-semibold">Portal Error</h2>
      <p className="text-sm text-muted-foreground">
        {error.message || "Something went wrong in the portal."}
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
