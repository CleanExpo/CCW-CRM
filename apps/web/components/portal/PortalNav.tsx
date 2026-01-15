"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import { DemoRequestForm } from "./DemoRequestForm";
import { ContactForm } from "./ContactForm";

export function PortalNav() {
  return (
    <div className="flex items-center gap-6">
      <nav className="flex items-center gap-6">
        <a
          href="/portal/showroom"
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Showroom
        </a>
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
      </nav>
      <div className="flex items-center gap-3">
        <ContactForm />
        <DemoRequestForm />
      </div>
    </div>
  );
}
