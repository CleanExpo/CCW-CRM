/**
 * Command Palette Component
 *
 * Provides a quick access menu for navigation and actions via keyboard.
 * Activated with Cmd+K (Mac) or Ctrl+K (Windows/Linux).
 */

"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  FileText,
  Package,
  Users,
  ShoppingCart,
  BarChart3,
  Truck,
  Container,
  Settings,
  Plus,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface CommandAction {
  id: string;
  label: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  keywords?: string[];
  category?: string;
  action: () => void;
}

interface CommandPaletteProps {
  actions?: CommandAction[];
}

const defaultActions: CommandAction[] = [
  // Navigation
  {
    id: "nav-dashboard",
    label: "Go to Dashboard",
    description: "View dashboard and metrics",
    icon: BarChart3,
    shortcut: "G then D",
    keywords: ["dashboard", "home", "metrics"],
    category: "Navigation",
    action: () => {},
  },
  {
    id: "nav-orders",
    label: "Go to Orders",
    description: "View and manage orders",
    icon: ShoppingCart,
    shortcut: "G then O",
    keywords: ["orders", "sales"],
    category: "Navigation",
    action: () => {},
  },
  {
    id: "nav-products",
    label: "Go to Products",
    description: "View product catalog",
    icon: Package,
    shortcut: "G then P",
    keywords: ["products", "catalog", "inventory"],
    category: "Navigation",
    action: () => {},
  },
  {
    id: "nav-customers",
    label: "Go to Customers",
    description: "View customer list",
    icon: Users,
    shortcut: "G then C",
    keywords: ["customers", "clients"],
    category: "Navigation",
    action: () => {},
  },
  {
    id: "nav-inventory",
    label: "Go to Inventory",
    description: "View stock levels",
    icon: Package,
    shortcut: "G then I",
    keywords: ["inventory", "stock", "warehouse"],
    category: "Navigation",
    action: () => {},
  },
  {
    id: "nav-backorders",
    label: "Go to Backorders",
    description: "View backorders",
    icon: FileText,
    shortcut: "G then B",
    keywords: ["backorders", "pending"],
    category: "Navigation",
    action: () => {},
  },
  {
    id: "nav-containers",
    label: "Go to Containers",
    description: "View container tracking",
    icon: Container,
    shortcut: "G then T",
    keywords: ["containers", "shipping", "tracking"],
    category: "Navigation",
    action: () => {},
  },
  // Quick Actions
  {
    id: "create-order",
    label: "Create New Order",
    description: "Create a new sales order",
    icon: Plus,
    shortcut: "C then O",
    keywords: ["create", "new", "order"],
    category: "Quick Actions",
    action: () => {},
  },
  {
    id: "create-product",
    label: "Create New Product",
    description: "Add a new product to catalog",
    icon: Plus,
    shortcut: "C then P",
    keywords: ["create", "new", "product"],
    category: "Quick Actions",
    action: () => {},
  },
  {
    id: "create-customer",
    label: "Create New Customer",
    description: "Add a new customer",
    icon: Plus,
    shortcut: "C then C",
    keywords: ["create", "new", "customer"],
    category: "Quick Actions",
    action: () => {},
  },
];

export function CommandPalette({ actions = defaultActions }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();

  // Open with Cmd+K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Bind actions to router
  const boundActions = React.useMemo(() => {
    return actions.map((action) => ({
      ...action,
      action: () => {
        // Navigation actions
        if (action.id.startsWith("nav-")) {
          const path = action.id.replace("nav-", "");
          router.push(`/${path}`);
        }
        // Create actions
        else if (action.id.startsWith("create-")) {
          const entity = action.id.replace("create-", "");
          router.push(`/${entity}/new`);
        }
        // Custom actions
        else {
          action.action();
        }
        setOpen(false);
      },
    }));
  }, [actions, router]);

  // Filter actions based on search
  const filteredActions = React.useMemo(() => {
    if (!search) return boundActions;

    const searchLower = search.toLowerCase();
    return boundActions.filter((action) => {
      const labelMatch = action.label.toLowerCase().includes(searchLower);
      const descMatch = action.description?.toLowerCase().includes(searchLower);
      const keywordMatch = action.keywords?.some((k) =>
        k.toLowerCase().includes(searchLower)
      );
      return labelMatch || descMatch || keywordMatch;
    });
  }, [search, boundActions]);

  // Group by category
  const groupedActions = React.useMemo(() => {
    const groups: Record<string, CommandAction[]> = {};
    filteredActions.forEach((action) => {
      const category = action.category || "Other";
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(action);
    });
    return groups;
  }, [filteredActions]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) =>
          i < filteredActions.length - 1 ? i + 1 : i
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i > 0 ? i - 1 : 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredActions[selectedIndex]) {
          filteredActions[selectedIndex].action();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, selectedIndex, filteredActions]);

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Reset search when opening
  useEffect(() => {
    if (open) {
      setSearch("");
      setSelectedIndex(0);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl p-0 gap-0">
        {/* Search Input */}
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Type a command or search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            autoFocus
          />
          <Badge variant="outline" className="ml-2 font-mono text-xs">
            ESC
          </Badge>
        </div>

        {/* Command List */}
        <div className="max-h-[400px] overflow-y-auto p-2">
          {Object.keys(groupedActions).length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No results found
            </div>
          ) : (
            Object.entries(groupedActions).map(([category, categoryActions]) => (
              <div key={category} className="mb-2">
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  {category}
                </div>
                {categoryActions.map((action, index) => {
                  const globalIndex = filteredActions.indexOf(action);
                  const Icon = action.icon;

                  return (
                    <button
                      key={action.id}
                      onClick={action.action}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors",
                        "hover:bg-accent",
                        globalIndex === selectedIndex &&
                          "bg-accent text-accent-foreground"
                      )}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                    >
                      {Icon && (
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div className="flex-1">
                        <div className="font-medium">{action.label}</div>
                        {action.description && (
                          <div className="text-xs text-muted-foreground">
                            {action.description}
                          </div>
                        )}
                      </div>
                      {action.shortcut && (
                        <Badge variant="outline" className="ml-auto font-mono text-xs">
                          {action.shortcut}
                        </Badge>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-50" />
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-3 py-2 text-xs text-muted-foreground flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span>
              <Badge variant="outline" className="mr-1 font-mono">↑↓</Badge>
              Navigate
            </span>
            <span>
              <Badge variant="outline" className="mr-1 font-mono">↵</Badge>
              Select
            </span>
          </div>
          <div>
            <Badge variant="outline" className="font-mono">⌘K</Badge>
            {" "}to toggle
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
