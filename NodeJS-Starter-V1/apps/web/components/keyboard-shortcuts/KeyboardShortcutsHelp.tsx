/**
 * Keyboard Shortcuts Help Component
 *
 * Displays all available keyboard shortcuts in a dialog.
 * Activated by pressing "?" key.
 */

"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  Navigation,
  PlusCircle,
  Search,
  Keyboard,
} from "lucide-react";

interface ShortcutGroup {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcuts: {
    keys: string[];
    description: string;
  }[];
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: "General",
    icon: Command,
    shortcuts: [
      { keys: ["⌘K", "Ctrl+K"], description: "Open command palette" },
      { keys: ["?"], description: "Show keyboard shortcuts help" },
      { keys: ["Esc"], description: "Close dialog or cancel action" },
      { keys: ["/"], description: "Focus search (if available)" },
    ],
  },
  {
    title: "Navigation",
    icon: Navigation,
    shortcuts: [
      { keys: ["G", "then", "D"], description: "Go to Dashboard" },
      { keys: ["G", "then", "O"], description: "Go to Orders" },
      { keys: ["G", "then", "P"], description: "Go to Products" },
      { keys: ["G", "then", "C"], description: "Go to Customers" },
      { keys: ["G", "then", "I"], description: "Go to Inventory" },
      { keys: ["G", "then", "B"], description: "Go to Backorders" },
      { keys: ["G", "then", "T"], description: "Go to Containers" },
      { keys: ["G", "then", "S"], description: "Go to Settings" },
    ],
  },
  {
    title: "Quick Actions",
    icon: PlusCircle,
    shortcuts: [
      { keys: ["C", "then", "O"], description: "Create new Order" },
      { keys: ["C", "then", "P"], description: "Create new Product" },
      { keys: ["C", "then", "C"], description: "Create new Customer" },
      { keys: ["C", "then", "Q"], description: "Create new Quote" },
    ],
  },
  {
    title: "Command Palette",
    icon: Search,
    shortcuts: [
      { keys: ["↑", "↓"], description: "Navigate through commands" },
      { keys: ["Enter"], description: "Execute selected command" },
      { keys: ["Esc"], description: "Close command palette" },
      { keys: ["Type"], description: "Search for commands" },
    ],
  },
];

export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);

  // Open with "?" key
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Don't trigger if typing in input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === "?") {
        e.preventDefault();
        setOpen(true);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            <DialogTitle>Keyboard Shortcuts</DialogTitle>
          </div>
          <DialogDescription>
            Use these keyboard shortcuts to navigate and perform actions faster
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {shortcutGroups.map((group) => {
            const Icon = group.icon;
            return (
              <div key={group.title}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm">{group.title}</h3>
                </div>
                <div className="space-y-2">
                  {group.shortcuts.map((shortcut, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-accent/50 transition-colors"
                    >
                      <span className="text-sm text-muted-foreground">
                        {shortcut.description}
                      </span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, keyIndex) => (
                          <React.Fragment key={keyIndex}>
                            {keyIndex > 0 && (
                              <span className="text-xs text-muted-foreground mx-1">
                                {key === "then" ? key : "+"}
                              </span>
                            )}
                            {key !== "then" && (
                              <Badge
                                variant="outline"
                                className="font-mono text-xs px-2"
                              >
                                {key}
                              </Badge>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground text-center">
            Press <Badge variant="outline" className="font-mono mx-1">?</Badge> anytime to show this help
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
