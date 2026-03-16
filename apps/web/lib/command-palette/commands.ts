/**
 * Command Palette Command Definitions
 * All available commands organized by group
 */

import {
  LayoutDashboard,
  Package,
  Warehouse,
  Container,
  AlertTriangle,
  Users,
  ShoppingCart,
  CreditCard,
  CheckSquare,
  FileText,
  ShoppingBag,
  Send,
  Mail,
  Lightbulb,
  Bell,
  ClipboardCheck,
  Activity,
  BarChart3,
  FileBarChart,
  Settings,
  Shield,
  Megaphone,
  ListTodo,
  Bot,
  Plus,
  Search,
  User,
  Building2,
  UsersRound,
  Puzzle,
  Languages,
  DollarSign,
  LogOut,
  Moon,
  Sun,
  Boxes,
  TrendingUp,
  Truck,
  Receipt,
  Store,
  Globe,
} from "lucide-react";
import { Command, CommandGroupConfig } from "./types";

/**
 * Command group configurations with labels and priorities
 */
export const COMMAND_GROUPS: CommandGroupConfig[] = [
  { id: "recent", label: "Recent Pages", priority: 1 },
  { id: "navigation", label: "Navigation", priority: 2 },
  { id: "actions", label: "Quick Actions", priority: 3 },
  { id: "search", label: "Search", priority: 4 },
  { id: "settings", label: "Settings", priority: 5 },
];

/**
 * Create navigation commands
 */
export function createNavigationCommands(
  navigate: (path: string) => void
): Command[] {
  return [
    {
      id: "nav-dashboard",
      label: "Dashboard",
      description: "Overview and metrics",
      keywords: ["dashboard", "home", "overview", "metrics"],
      icon: LayoutDashboard,
      group: "navigation",
      action: () => navigate("/dashboard"),
      shortcut: "G D",
    },
    {
      id: "nav-products",
      label: "Products",
      description: "Product catalog",
      keywords: ["products", "catalog", "items", "inventory"],
      icon: Package,
      group: "navigation",
      action: () => navigate("/products"),
      shortcut: "G P",
    },
    {
      id: "nav-inventory",
      label: "Inventory",
      description: "Stock management",
      keywords: ["inventory", "stock", "warehouse"],
      icon: Boxes,
      group: "navigation",
      action: () => navigate("/inventory"),
      shortcut: "G I",
    },
    {
      id: "nav-warehouse",
      label: "Warehouse Operations",
      description: "Warehouse management",
      keywords: ["warehouse", "operations", "logistics"],
      icon: Warehouse,
      group: "navigation",
      action: () => navigate("/warehouse"),
      shortcut: "G W",
    },
    {
      id: "nav-containers",
      label: "Containers",
      description: "Container tracking",
      keywords: ["containers", "shipping", "freight"],
      icon: Container,
      group: "navigation",
      action: () => navigate("/containers"),
    },
    {
      id: "nav-backorders",
      label: "Backorders",
      description: "Manage backorders",
      keywords: ["backorders", "pending", "unfulfilled"],
      icon: AlertTriangle,
      group: "navigation",
      action: () => navigate("/backorders"),
    },
    {
      id: "nav-customers",
      label: "Customers",
      description: "Customer directory",
      keywords: ["customers", "clients", "contacts"],
      icon: Users,
      group: "navigation",
      action: () => navigate("/customers"),
      shortcut: "G C",
    },
    {
      id: "nav-orders",
      label: "Orders",
      description: "Sales orders",
      keywords: ["orders", "sales", "purchases"],
      icon: ShoppingCart,
      group: "navigation",
      action: () => navigate("/orders"),
      shortcut: "G O",
    },
    {
      id: "nav-pos",
      label: "POS Terminal",
      description: "Point of sale",
      keywords: ["pos", "point of sale", "terminal", "checkout"],
      icon: CreditCard,
      group: "navigation",
      action: () => navigate("/pos"),
    },
    {
      id: "nav-reconciliation",
      label: "Reconciliation",
      description: "Financial reconciliation",
      keywords: ["reconciliation", "accounting", "finance"],
      icon: CheckSquare,
      group: "navigation",
      action: () => navigate("/reconciliation"),
    },
    {
      id: "nav-quotes",
      label: "Quotes",
      description: "Customer quotes",
      keywords: ["quotes", "quotations", "estimates"],
      icon: FileText,
      group: "navigation",
      action: () => navigate("/quotes"),
      shortcut: "G Q",
    },
    {
      id: "nav-purchase-orders",
      label: "Purchase Orders",
      description: "Supplier orders",
      keywords: ["purchase orders", "po", "procurement"],
      icon: ShoppingBag,
      group: "navigation",
      action: () => navigate("/purchase-orders"),
    },
    {
      id: "nav-shipments",
      label: "Shipments",
      description: "Shipment tracking",
      keywords: ["shipments", "shipping", "delivery", "tracking"],
      icon: Truck,
      group: "navigation",
      action: () => navigate("/shipments"),
    },
    {
      id: "nav-submissions",
      label: "Submissions",
      description: "Form submissions",
      keywords: ["submissions", "forms", "requests"],
      icon: Send,
      group: "navigation",
      action: () => navigate("/submissions"),
    },
    {
      id: "nav-emails",
      label: "Emails",
      description: "Email management",
      keywords: ["emails", "messages", "communication"],
      icon: Mail,
      group: "navigation",
      action: () => navigate("/emails"),
    },
    {
      id: "nav-prd",
      label: "PRD Generator",
      description: "Product requirements",
      keywords: ["prd", "product requirements", "specifications"],
      icon: Lightbulb,
      group: "navigation",
      action: () => navigate("/prd/generate"),
    },
    {
      id: "nav-insights",
      label: "Insights",
      description: "Business insights",
      keywords: ["insights", "analytics", "intelligence"],
      icon: TrendingUp,
      group: "navigation",
      action: () => navigate("/insights"),
    },
    {
      id: "nav-monitoring",
      label: "Monitoring",
      description: "System monitoring",
      keywords: ["monitoring", "alerts", "system", "health"],
      icon: Activity,
      group: "navigation",
      action: () => navigate("/monitoring"),
    },
    {
      id: "nav-analytics",
      label: "Analytics",
      description: "Advanced analytics",
      keywords: ["analytics", "reports", "data"],
      icon: BarChart3,
      group: "navigation",
      action: () => navigate("/analytics"),
    },
    {
      id: "nav-reports",
      label: "Reports",
      description: "Generate reports",
      keywords: ["reports", "export", "documents"],
      icon: FileBarChart,
      group: "navigation",
      action: () => navigate("/reports"),
    },
    {
      id: "nav-suppliers",
      label: "Suppliers",
      description: "Supplier management",
      keywords: ["suppliers", "vendors", "procurement"],
      icon: Store,
      group: "navigation",
      action: () => navigate("/suppliers"),
    },
    {
      id: "nav-settings",
      label: "Settings",
      description: "Application settings",
      keywords: ["settings", "preferences", "configuration"],
      icon: Settings,
      group: "navigation",
      action: () => navigate("/settings"),
      shortcut: "G S",
    },
    {
      id: "nav-admin",
      label: "Admin Panel",
      description: "Administration",
      keywords: ["admin", "administration", "management"],
      icon: Shield,
      group: "navigation",
      action: () => navigate("/admin"),
    },
    {
      id: "nav-marketing",
      label: "Marketing",
      description: "Marketing tools",
      keywords: ["marketing", "campaigns", "promotions"],
      icon: Megaphone,
      group: "navigation",
      action: () => navigate("/marketing"),
    },
    {
      id: "nav-tasks",
      label: "Tasks",
      description: "Task management",
      keywords: ["tasks", "todo", "work items"],
      icon: ListTodo,
      group: "navigation",
      action: () => navigate("/tasks"),
    },
    {
      id: "nav-agents",
      label: "AI Agents",
      description: "AI agent management",
      keywords: ["agents", "ai", "automation"],
      icon: Bot,
      group: "navigation",
      action: () => navigate("/agents"),
    },
    {
      id: "nav-ai-assistant",
      label: "AI Assistant",
      description: "AI-powered assistance",
      keywords: ["ai", "assistant", "help", "chat"],
      icon: Bot,
      group: "navigation",
      action: () => navigate("/ai-assistant"),
    },
    {
      id: "nav-integration-demo",
      label: "Integration Demo",
      description: "Integration showcase",
      keywords: ["integration", "demo", "showcase", "api"],
      icon: Globe,
      group: "navigation",
      action: () => navigate("/integration-demo"),
    },
  ];
}

/**
 * Create action commands
 */
export function createActionCommands(navigate: (path: string) => void): Command[] {
  return [
    {
      id: "action-create-product",
      label: "Create Product",
      description: "Add a new product",
      keywords: ["create", "new", "add", "product"],
      icon: Plus,
      group: "actions",
      action: () => navigate("/products?action=create"),
      shortcut: "C P",
    },
    {
      id: "action-new-customer",
      label: "New Customer",
      description: "Add a new customer",
      keywords: ["new", "add", "customer", "client"],
      icon: Plus,
      group: "actions",
      action: () => navigate("/customers?action=create"),
      shortcut: "C C",
    },
    {
      id: "action-new-order",
      label: "New Order",
      description: "Create a sales order",
      keywords: ["new", "create", "order", "sale"],
      icon: Plus,
      group: "actions",
      action: () => navigate("/orders?action=create"),
      shortcut: "C O",
    },
    {
      id: "action-new-quote",
      label: "New Quote",
      description: "Create a quote",
      keywords: ["new", "create", "quote", "estimate"],
      icon: Plus,
      group: "actions",
      action: () => navigate("/quotes?action=create"),
      shortcut: "C Q",
    },
    {
      id: "action-new-po",
      label: "New Purchase Order",
      description: "Create a purchase order",
      keywords: ["new", "create", "purchase order", "po"],
      icon: Plus,
      group: "actions",
      action: () => navigate("/purchase-orders?action=create"),
    },
    {
      id: "action-generate-prd",
      label: "Generate PRD",
      description: "Create product requirements",
      keywords: ["generate", "prd", "requirements"],
      icon: Lightbulb,
      group: "actions",
      action: () => navigate("/prd/generate"),
    },
  ];
}

/**
 * Create search commands
 */
export function createSearchCommands(navigate: (path: string) => void): Command[] {
  return [
    {
      id: "search-products",
      label: "Search Products",
      description: "Find products in catalog",
      keywords: ["search", "find", "products", "catalog"],
      icon: Search,
      group: "search",
      action: () => navigate("/products?focus=search"),
      shortcut: "S P",
    },
    {
      id: "search-customers",
      label: "Search Customers",
      description: "Find customers",
      keywords: ["search", "find", "customers", "clients"],
      icon: Search,
      group: "search",
      action: () => navigate("/customers?focus=search"),
      shortcut: "S C",
    },
    {
      id: "search-orders",
      label: "Search Orders",
      description: "Find orders",
      keywords: ["search", "find", "orders", "sales"],
      icon: Search,
      group: "search",
      action: () => navigate("/orders?focus=search"),
      shortcut: "S O",
    },
    {
      id: "search-inventory",
      label: "Search Inventory",
      description: "Find inventory items",
      keywords: ["search", "find", "inventory", "stock"],
      icon: Search,
      group: "search",
      action: () => navigate("/inventory?focus=search"),
      shortcut: "S I",
    },
  ];
}

/**
 * Create settings commands
 */
export function createSettingsCommands(
  navigate: (path: string) => void,
  toggleTheme?: () => void,
  logout?: () => void
): Command[] {
  const commands: Command[] = [
    {
      id: "settings-account",
      label: "Account Settings",
      description: "Manage your account",
      keywords: ["settings", "account", "profile", "user"],
      icon: User,
      group: "settings",
      action: () => navigate("/settings/account"),
    },
    {
      id: "settings-company",
      label: "Company Settings",
      description: "Company information",
      keywords: ["settings", "company", "organization"],
      icon: Building2,
      group: "settings",
      action: () => navigate("/settings/company"),
    },
    {
      id: "settings-team",
      label: "Team Settings",
      description: "Manage team members",
      keywords: ["settings", "team", "users", "members"],
      icon: UsersRound,
      group: "settings",
      action: () => navigate("/settings/team"),
    },
    {
      id: "settings-integrations",
      label: "Integrations",
      description: "Third-party integrations",
      keywords: ["settings", "integrations", "api", "connections"],
      icon: Puzzle,
      group: "settings",
      action: () => navigate("/settings/integrations"),
    },
    {
      id: "settings-translations",
      label: "Translations",
      description: "Multi-language settings",
      keywords: ["settings", "translations", "language", "i18n"],
      icon: Languages,
      group: "settings",
      action: () => navigate("/settings/translations"),
    },
    {
      id: "settings-billing",
      label: "Billing",
      description: "Billing and payments",
      keywords: ["settings", "billing", "payments", "subscription"],
      icon: DollarSign,
      group: "settings",
      action: () => navigate("/settings/billing"),
    },
  ];

  // Add theme toggle if provided
  if (toggleTheme) {
    commands.push({
      id: "settings-theme",
      label: "Toggle Theme",
      description: "Switch between light and dark mode",
      keywords: ["theme", "dark", "light", "mode", "appearance"],
      icon: Moon,
      group: "settings",
      action: toggleTheme,
      shortcut: "T",
    });
  }

  // Add logout if provided
  if (logout) {
    commands.push({
      id: "settings-logout",
      label: "Logout",
      description: "Sign out of your account",
      keywords: ["logout", "sign out", "exit"],
      icon: LogOut,
      group: "settings",
      action: logout,
    });
  }

  return commands;
}
