"use client";

import { Bell } from "lucide-react";

export default function AlertsPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Alerts</h1>
      </div>
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <Bell className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium">No active alerts</h3>
        <p className="text-sm text-muted-foreground mt-1">
          System alerts and notifications will appear here.
        </p>
      </div>
    </div>
  );
}
