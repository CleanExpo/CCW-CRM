"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Package,
  Users,
  FileText,
  ShoppingCart,
  Truck,
  Settings,
  CreditCard,
  UserPlus,
  Building2,
  Search,
} from "lucide-react";

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  keywords?: string[];
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const navigate = (path: string) => {
    setOpen(false);
    router.push(path as any);
  };

  const commands: Command[] = [
    // Navigation
    {
      id: "dashboard",
      label: "Dashboard",
      description: "View overview and metrics",
      icon: LayoutDashboard,
      action: () => navigate("/dashboard"),
      keywords: ["home", "overview"],
    },
    {
      id: "products",
      label: "Products",
      description: "Manage product catalog",
      icon: Package,
      action: () => navigate("/products"),
      keywords: ["catalog", "items", "inventory"],
    },
    {
      id: "customers",
      label: "Customers",
      description: "Manage customer accounts",
      icon: Users,
      action: () => navigate("/customers"),
      keywords: ["clients", "accounts"],
    },
    {
      id: "orders",
      label: "Orders",
      description: "View and manage orders",
      icon: ShoppingCart,
      action: () => navigate("/orders"),
      keywords: ["sales", "purchases"],
    },
    {
      id: "quotes",
      label: "Quotes",
      description: "Create and manage quotes",
      icon: FileText,
      action: () => navigate("/quotes"),
      keywords: ["proposals", "estimates"],
    },
    {
      id: "suppliers",
      label: "Suppliers",
      description: "Manage supplier relationships",
      icon: Truck,
      action: () => navigate("/suppliers"),
      keywords: ["vendors"],
    },

    // Quick Actions
    {
      id: "new-product",
      label: "New Product",
      description: "Create a new product",
      icon: Package,
      action: () => navigate("/products?action=new"),
      keywords: ["create", "add"],
    },
    {
      id: "new-customer",
      label: "New Customer",
      description: "Add a new customer",
      icon: UserPlus,
      action: () => navigate("/customers?action=new"),
      keywords: ["create", "add"],
    },
    {
      id: "new-quote",
      label: "New Quote",
      description: "Create a new quote",
      icon: FileText,
      action: () => navigate("/quotes?action=new"),
      keywords: ["create", "add", "proposal"],
    },

    // Settings
    {
      id: "settings-account",
      label: "Account Settings",
      description: "Manage your account",
      icon: Settings,
      action: () => navigate("/settings/account"),
      keywords: ["profile", "preferences"],
    },
    {
      id: "settings-team",
      label: "Team Management",
      description: "Manage team members and roles",
      icon: Users,
      action: () => navigate("/settings/team"),
      keywords: ["users", "permissions"],
    },
    {
      id: "settings-company",
      label: "Company Settings",
      description: "Update company information",
      icon: Building2,
      action: () => navigate("/settings/company"),
      keywords: ["organization", "business"],
    },
    {
      id: "settings-billing",
      label: "Billing & Subscription",
      description: "Manage billing and plans",
      icon: CreditCard,
      action: () => navigate("/settings/billing"),
      keywords: ["payment", "subscription", "plan"],
    },
  ];

  const navigationCommands = commands.filter(
    (cmd) =>
      ["dashboard", "products", "customers", "orders", "quotes", "suppliers"].includes(cmd.id)
  );

  const actionCommands = commands.filter((cmd) =>
    ["new-product", "new-customer", "new-quote"].includes(cmd.id)
  );

  const settingsCommands = commands.filter((cmd) => cmd.id.startsWith("settings-"));

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          {navigationCommands.map((command) => {
            const Icon = command.icon;
            return (
              <CommandItem
                key={command.id}
                onSelect={() => command.action()}
                className="cursor-pointer"
              >
                <Icon className="mr-2 h-4 w-4" />
                <div className="flex flex-col">
                  <span>{command.label}</span>
                  {command.description && (
                    <span className="text-xs text-muted-foreground">{command.description}</span>
                  )}
                </div>
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Quick Actions">
          {actionCommands.map((command) => {
            const Icon = command.icon;
            return (
              <CommandItem
                key={command.id}
                onSelect={() => command.action()}
                className="cursor-pointer"
              >
                <Icon className="mr-2 h-4 w-4" />
                <div className="flex flex-col">
                  <span>{command.label}</span>
                  {command.description && (
                    <span className="text-xs text-muted-foreground">{command.description}</span>
                  )}
                </div>
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Settings">
          {settingsCommands.map((command) => {
            const Icon = command.icon;
            return (
              <CommandItem
                key={command.id}
                onSelect={() => command.action()}
                className="cursor-pointer"
              >
                <Icon className="mr-2 h-4 w-4" />
                <div className="flex flex-col">
                  <span>{command.label}</span>
                  {command.description && (
                    <span className="text-xs text-muted-foreground">{command.description}</span>
                  )}
                </div>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
