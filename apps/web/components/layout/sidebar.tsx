"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
  FileText,
  ClipboardList,
  ClipboardCheck,
  Bot,
  TrendingUp,
  Mail,
  Settings,
  Warehouse,
  Ship,
  Truck,
  AlertCircle,
  Bell,
  CheckCircle,
  Sparkles,
  Activity,
  CreditCard,
  Scale,
  BarChart3,
  FileBarChart,
  Shield,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Products", href: "/products", icon: Package },
  { name: "Inventory", href: "/inventory", icon: Warehouse },
  { name: "Warehouse Ops", href: "/warehouse", icon: Truck },
  { name: "Containers", href: "/containers", icon: Ship },
  { name: "Backorders", href: "/backorders", icon: AlertCircle },
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Orders", href: "/orders", icon: ShoppingCart },
  { name: "POS Terminal", href: "/pos", icon: CreditCard },
  { name: "Reconciliation", href: "/pos/reconciliation", icon: Scale },
  { name: "Quotes", href: "/quotes", icon: FileText },
  { name: "Purchase Orders", href: "/purchase-orders", icon: ClipboardList },
  { name: "Submissions", href: "/submissions", icon: ClipboardCheck },
  { name: "Emails", href: "/emails", icon: Mail },
  // { name: "AI Assistant", href: "/ai-assistant", icon: Bot }, // Hidden for demo - incomplete implementation
  { name: "PRD Generator", href: "/prd/generate", icon: Sparkles },
  { name: "Insights", href: "/insights", icon: TrendingUp },
  { name: "Alerts", href: "/alerts", icon: Bell },
  { name: "Approvals", href: "/approvals", icon: CheckCircle },
  { name: "Monitoring", href: "/monitoring", icon: Activity },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Reports", href: "/reports", icon: FileBarChart },
  { name: "Settings", href: "/settings/integrations", icon: Settings },
  { name: "Admin", href: "/admin", icon: Shield },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r bg-muted/40">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold group">
          <motion.span
            className="text-xl"
            whileHover={{ scale: 1.1, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
          >
            ⚙️
          </motion.span>
          <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent group-hover:from-primary/80 group-hover:to-primary/40 transition-all">
            Equipment ERP
          </span>
        </Link>
      </div>
      <nav className="flex flex-col gap-1 p-4">
        {navigation.map((item, index) => {
          const isActive = pathname === item.href;
          return (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05, type: "spring", stiffness: 300, damping: 25 }}
            >
              <Link
                href={item.href as any}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all relative overflow-hidden group",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground hover:scale-105"
                )}
              >
                {/* Active indicator */}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-indicator"
                    className="absolute left-0 top-0 bottom-0 w-1 bg-primary-foreground rounded-r-full"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}

                {/* Icon with hover effect */}
                <motion.div
                  whileHover={{ scale: 1.2, rotate: isActive ? 0 : 15 }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                >
                  <item.icon className="h-4 w-4" />
                </motion.div>

                {/* Text */}
                <span className="relative z-10">{item.name}</span>

                {/* Hover background effect */}
                {!isActive && (
                  <motion.div
                    className="absolute inset-0 bg-primary/5 rounded-lg"
                    initial={{ scale: 0, opacity: 0 }}
                    whileHover={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  />
                )}
              </Link>
            </motion.div>
          );
        })}
      </nav>
    </aside>
  );
}
