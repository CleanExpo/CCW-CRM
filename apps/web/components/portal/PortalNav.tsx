"use client";

import { DemoRequestForm } from "@/components/portal/DemoRequestForm";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";

export function PortalNav() {
  return (
    <nav className="flex items-center gap-4">
      <a
        href="/portal/walk-in"
        className="text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        Walk-In
      </a>
      <a
        href="/portal/phone"
        className="text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        Phone Orders
      </a>
      <a
        href="/portal/internet"
        className="text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        Internet
      </a>
      <a
        href="/portal/service"
        className="text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        Service
      </a>
      <DemoRequestForm
        triggerButton={
          <Button variant="default" size="sm">
            <Calendar className="h-4 w-4 mr-2" />
            Request Demo
          </Button>
        }
      />
    </nav>
  );
}
