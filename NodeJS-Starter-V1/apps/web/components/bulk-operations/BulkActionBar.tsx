/**
 * Bulk Action Bar Component
 *
 * A floating action bar that appears at the bottom of the screen when items are selected.
 * Provides quick access to bulk operations like delete, status update, export, etc.
 */

"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BulkAction {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost";
  onClick: () => void;
  disabled?: boolean;
}

interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  actions: BulkAction[];
  onClearSelection: () => void;
  onSelectAll?: () => void;
  className?: string;
}

export function BulkActionBar({
  selectedCount,
  totalCount,
  actions,
  onClearSelection,
  onSelectAll,
  className,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  const allSelected = selectedCount === totalCount;

  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
        "animate-in slide-in-from-bottom-5 duration-300",
        className
      )}
    >
      <div className="bg-background border rounded-lg shadow-lg p-4 flex items-center gap-4">
        {/* Selection Info */}
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm font-semibold">
            {selectedCount} selected
          </Badge>
          {!allSelected && onSelectAll && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSelectAll}
              className="h-8 text-xs"
            >
              Select all {totalCount}
            </Button>
          )}
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-border" />

        {/* Actions */}
        <div className="flex items-center gap-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.id}
                variant={action.variant || "default"}
                size="sm"
                onClick={action.onClick}
                disabled={action.disabled}
                className="h-8"
              >
                {Icon && <Icon className="mr-2 h-4 w-4" />}
                {action.label}
              </Button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-border" />

        {/* Clear Selection */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="h-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
