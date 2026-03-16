"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GlassButton } from "@/components/ui/glass-button";
import { Typewriter } from "@/components/ui/typewriter-text";
import {
  ExternalLink,
  Package,
  FileText,
  CreditCard,
  MessageCircle,
  ShoppingCart,
  TrendingUp,
  Users,
  Clock,
  CheckCircle2
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

const portalFeatures = [
  {
    title: "Order Tracking",
    description: "Track all orders in real-time with live shipment updates",
    icon: Package,
    href: "/portal/orders",
    stats: "24 active orders",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10"
  },
  {
    title: "Invoices & Quotes",
    description: "Download invoices and review quote history",
    icon: FileText,
    href: "/portal/invoices",
    stats: "12 pending invoices",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10"
  },
  {
    title: "Payment Methods",
    description: "Manage credit cards and payment preferences",
    icon: CreditCard,
    href: "/portal/payments",
    stats: "2 saved cards",
    color: "text-teal-500",
    bgColor: "bg-teal-500/10"
  },
  {
    title: "Support Tickets",
    description: "Submit and track customer support requests",
    icon: MessageCircle,
    href: "/portal/support",
    stats: "1 open ticket",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10"
  },
  {
    title: "Quick Reorder",
    description: "Reorder previous purchases with one click",
    icon: ShoppingCart,
    href: "/portal/reorder",
    stats: "15 frequent items",
    color: "text-pink-500",
    bgColor: "bg-pink-500/10"
  },
  {
    title: "Account Analytics",
    description: "View spending trends and order history analytics",
    icon: TrendingUp,
    href: "/portal/analytics",
    stats: "$45.2k this year",
    color: "text-green-500",
    bgColor: "bg-green-500/10"
  }
];

const recentActivity = [
  {
    type: "order",
    title: "Order #ORD-2024-145 Delivered",
    description: "Heavy Duty Drill Set delivered to Sydney warehouse",
    time: "2 hours ago",
    icon: CheckCircle2,
    color: "text-green-500"
  },
  {
    type: "invoice",
    title: "Invoice #INV-2024-089 Ready",
    description: "$2,450 due by March 25, 2026",
    time: "5 hours ago",
    icon: FileText,
    color: "text-blue-500"
  },
  {
    type: "quote",
    title: "Quote #Q-2024-067 Sent",
    description: "Industrial Equipment Package - $12,500",
    time: "1 day ago",
    icon: FileText,
    color: "text-purple-500"
  }
];

const stats = [
  { label: "Active Orders", value: "24", icon: Package },
  { label: "Pending Invoices", value: "12", icon: FileText },
  { label: "Support Tickets", value: "1", icon: MessageCircle }
];

export default function CustomerPortalPage() {
  return (
    <div className="space-y-8 pb-12">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="space-y-3">
            <Badge variant="outline">
              <Users className="w-3 h-3 mr-2" />
              Customer Portal
            </Badge>
            <h1 className="text-4xl font-semibold tracking-tight">
              Welcome to Your Portal
            </h1>
            <div className="text-lg text-muted-foreground">
              <Typewriter
                text={[
                  "Track orders • Download invoices • Manage payments",
                  "24/7 access to your account • Real-time order updates",
                  "Quick reorder • Support tickets • Analytics dashboard"
                ]}
                speed={50}
                loop={true}
              />
            </div>
          </div>

          <GlassButton contentClassName="flex items-center gap-2">
            <ExternalLink className="w-4 h-4" />
            Share Portal Link
          </GlassButton>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="border-border">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="p-2 rounded-lg bg-brand-primary/10">
                        <Icon className="w-5 h-5 text-brand-primary" />
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-bold">{stat.value}</p>
                        <p className="text-sm text-muted-foreground">{stat.label}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Portal Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {portalFeatures.map((feature, index) => {
          const Icon = feature.icon;

          return (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
            >
              <Link href={feature.href as any}>
                <Card className="h-full border-border hover:border-brand-primary/50 transition-all hover:scale-[1.02] hover:shadow-xl cursor-pointer group">
                  <CardHeader>
                    <div className={`p-3 rounded-lg ${feature.bgColor} w-fit mb-3`}>
                      <Icon className={`w-6 h-6 ${feature.color}`} />
                    </div>
                    <CardTitle className="text-lg group-hover:text-brand-primary transition-colors">
                      {feature.title}
                    </CardTitle>
                    <CardDescription className="text-sm">
                      {feature.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">
                        {feature.stats}
                      </span>
                      <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-brand-primary group-hover:translate-x-1 transition-all" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {/* Recent Activity & Actions */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.9 }}
        >
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Recent Activity
              </CardTitle>
              <CardDescription>
                Latest updates on your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.map((activity, index) => {
                  const Icon = activity.icon;
                  return (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className={`p-2 rounded-lg bg-muted`}>
                        <Icon className={`w-4 h-4 ${activity.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">
                          {activity.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {activity.description}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {activity.time}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.0 }}
        >
          <Card className="border-brand-primary/20 bg-gradient-brand/5 h-full">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Common tasks for faster workflow
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/portal/orders" className="block">
                <div className="p-4 rounded-lg border border-border hover:border-brand-primary/50 bg-background transition-all hover:scale-[1.02] cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Package className="w-5 h-5 text-brand-primary" />
                      <span className="font-medium">View All Orders</span>
                    </div>
                    <ExternalLink className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </Link>

              <Link href={"/portal/invoices" as any} className="block">
                <div className="p-4 rounded-lg border border-border hover:border-brand-primary/50 bg-background transition-all hover:scale-[1.02] cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-brand-primary" />
                      <span className="font-medium">Download Invoices</span>
                    </div>
                    <ExternalLink className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </Link>

              <Link href={"/portal/support" as any} className="block">
                <div className="p-4 rounded-lg border border-border hover:border-brand-primary/50 bg-background transition-all hover:scale-[1.02] cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <MessageCircle className="w-5 h-5 text-brand-primary" />
                      <span className="font-medium">Contact Support</span>
                    </div>
                    <ExternalLink className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </Link>

              <div className="pt-3 border-t border-border">
                <GlassButton className="w-full" contentClassName="flex items-center justify-center gap-2">
                  <ShoppingCart className="w-4 h-4" />
                  Place New Order
                </GlassButton>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
