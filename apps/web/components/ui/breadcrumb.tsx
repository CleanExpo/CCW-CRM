"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

/**
 * PHASE 4: Breadcrumb Navigation Component
 *
 * Displays navigation path to help users understand their location
 * and quickly navigate back to parent pages.
 *
 * @example
 * <Breadcrumb
 *   items={[
 *     { label: "Dashboard", href: "/dashboard" },
 *     { label: "Orders", href: "/orders" },
 *     { label: "ORD-2026-001" }
 *   ]}
 * />
 */
export function Breadcrumb({ items, className }: BreadcrumbProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center space-x-1 text-sm", className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <React.Fragment key={index}>
            {index > 0 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            )}
            {item.href && !isLast ? (
              <Link
                href={item.href as any}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className={cn(isLast ? "font-medium text-foreground" : "text-muted-foreground")}>
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
