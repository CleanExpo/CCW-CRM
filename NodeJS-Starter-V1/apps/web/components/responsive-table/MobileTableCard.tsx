"use client";

import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MobileTableCardProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function MobileTableCard({ children, onClick, className }: MobileTableCardProps) {
  return (
    <Card
      className={cn(
        "p-4 space-y-3 md:hidden",
        onClick && "cursor-pointer hover:bg-accent transition-colors",
        className
      )}
      onClick={onClick}
    >
      {children}
    </Card>
  );
}

interface MobileTableRowProps {
  label: string;
  children: ReactNode;
  className?: string;
}

export function MobileTableRow({ label, children, className }: MobileTableRowProps) {
  return (
    <div className={cn("flex justify-between items-start gap-4", className)}>
      <span className="text-sm font-medium text-muted-foreground min-w-[100px]">{label}</span>
      <div className="text-sm text-right flex-1">{children}</div>
    </div>
  );
}
