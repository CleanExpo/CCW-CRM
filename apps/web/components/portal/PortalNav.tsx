"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { useState } from "react";
import { ContactForm } from "./ContactForm";
import { DemoRequestForm } from "./DemoRequestForm";

const navLinks = [
  { href: "/portal/showroom", label: "Showroom" },
  { href: "/portal/walk-in", label: "Walk-In" },
  { href: "/portal/phone", label: "Phone Orders" },
  { href: "/portal/internet", label: "Internet" },
  { href: "/portal/service", label: "Service" },
];

export function PortalNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-2 lg:gap-4">
      {/* Desktop Navigation - hidden on small screens */}
      <nav className="hidden lg:flex items-center gap-3 xl:gap-5">
        {navLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
          >
            {link.label}
          </a>
        ))}
      </nav>

      {/* Desktop Action Buttons */}
      <div className="hidden lg:flex items-center gap-2">
        <ContactForm />
        <DemoRequestForm />
      </div>

      {/* Mobile Menu Button */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild className="lg:hidden">
          <Button variant="ghost" size="icon" className="shrink-0">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[280px] sm:w-[320px]" aria-describedby={undefined}>
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <nav className="flex flex-col gap-4 mt-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="text-base font-medium text-foreground hover:text-primary transition-colors py-2"
              >
                {link.label}
              </a>
            ))}
            <div className="border-t pt-4 mt-4 flex flex-col gap-3">
              <ContactForm />
              <DemoRequestForm />
            </div>
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
