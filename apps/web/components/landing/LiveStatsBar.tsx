"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import {
  Package,
  Users,
  ShoppingCart,
  DollarSign,
  FileText,
  LayoutGrid,
} from "lucide-react";
import { AnimatedCounter } from "./AnimatedCounter";

export interface PublicStats {
  total_products: number;
  total_customers: number;
  active_orders: number;
  pending_quotes: number;
  total_revenue_this_month: string;
  low_stock_alerts: number;
  product_categories: number;
  warehouse_count: number;
  fetched_at: string;
}

interface LiveStatsBarProps {
  stats: PublicStats | null;
}

const statItems = [
  {
    key: "total_products" as const,
    label: "Products",
    icon: Package,
  },
  {
    key: "total_customers" as const,
    label: "Customers",
    icon: Users,
  },
  {
    key: "active_orders" as const,
    label: "Active Orders",
    icon: ShoppingCart,
  },
  {
    key: "total_revenue_this_month" as const,
    label: "Revenue (Month)",
    icon: DollarSign,
  },
  {
    key: "pending_quotes" as const,
    label: "Open Quotes",
    icon: FileText,
  },
  {
    key: "product_categories" as const,
    label: "Categories",
    icon: LayoutGrid,
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export const LiveStatsBar = memo(function LiveStatsBar({
  stats,
}: LiveStatsBarProps) {
  if (!stats) return null;

  const revenueNum = parseFloat(stats.total_revenue_this_month) || 0;

  return (
    <section className="border-t border-b bg-muted/30">
      <div className="container mx-auto px-6 py-10 md:py-12">
        {/* Header with live indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
          </span>
          <span className="text-sm font-medium text-muted-foreground tracking-wide uppercase">
            Live Platform Data
          </span>
        </div>

        {/* Stats grid */}
        <motion.div
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-6"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          {statItems.map((item) => {
            const Icon = item.icon;
            const isRevenue = item.key === "total_revenue_this_month";

            return (
              <motion.div
                key={item.key}
                variants={itemVariants}
                className="text-center p-4 rounded-xl border bg-card hover:shadow-md transition-shadow"
              >
                <div className="mx-auto mb-2.5 p-2 rounded-lg bg-primary/10 w-fit">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                  {isRevenue ? (
                    <AnimatedCounter
                      value={revenueNum}
                      prefix="$"
                      compact
                    />
                  ) : (
                    <AnimatedCounter
                      value={stats[item.key] as number}
                    />
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1 font-medium">
                  {item.label}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
});
