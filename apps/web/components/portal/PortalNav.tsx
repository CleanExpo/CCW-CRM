"use client";

import type { Route } from "next";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ContactForm } from "./ContactForm";
import { DemoRequestForm } from "./DemoRequestForm";

const navLinks: Array<{ href: Route; label: string }> = [
  { href: "/portal/showroom" as Route, label: "Showroom" },
  { href: "/portal/walk-in" as Route, label: "Walk-In" },
  { href: "/portal/phone" as Route, label: "Phone Orders" },
  { href: "/portal/internet" as Route, label: "Internet" },
  { href: "/portal/service" as Route, label: "Service" },
];

export function PortalNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isActive = (href: Route) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="flex items-center gap-2 lg:gap-4">
      {/* Desktop Navigation - hidden on small screens */}
      <nav className="hidden lg:flex items-center gap-3 xl:gap-5">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive(link.href) ? "page" : undefined}
            className={`text-sm font-medium transition-colors whitespace-nowrap ${
              isActive(link.href)
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {link.label}
          </Link>
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
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={`text-base font-medium transition-colors py-2 ${
                  isActive(link.href)
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-primary"
                }`}
              >
                {link.label}
              </Link>
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
