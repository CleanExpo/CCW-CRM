"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { GlassButton } from "@/components/ui/glass-button";
import TrackingFeaturesSection from "@/components/features/tracking-features-section";
import { MapPin, Package, TrendingUp, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

const trackingStats = [
  {
    label: "Active Shipments",
    value: "24",
    change: "+12%",
    trend: "up",
    icon: Package,
  },
  {
    label: "On-Time Delivery",
    value: "96.5%",
    change: "+2.3%",
    trend: "up",
    icon: TrendingUp,
  },
  {
    label: "Delayed",
    value: "2",
    change: "-50%",
    trend: "down",
    icon: AlertCircle,
  },
];

export default function ShipmentTrackingPage() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                <MapPin className="w-3 h-3 mr-2" />
                Real-Time Tracking
              </Badge>
              <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse mr-2" />
                Live
              </Badge>
            </div>
            <h1 className="text-4xl font-semibold tracking-tight">
              Shipment Tracking
            </h1>
            <p className="text-muted-foreground text-lg">
              Monitor all deliveries in real-time with precise location updates and customer notifications.
            </p>
          </div>

          <Link href="/shipments">
            <GlassButton>View All Shipments</GlassButton>
          </Link>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {trackingStats.map((stat, index) => {
            const Icon = stat.icon;
            const isPositive = stat.trend === "up";
            const changeColor = isPositive ? "text-green-500" : "text-red-500";

            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="border-border">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-2 rounded-lg bg-muted">
                        <Icon className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <span className={`text-sm font-medium ${changeColor}`}>
                        {stat.change}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-3xl font-bold">{stat.value}</p>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Tracking Features Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <TrackingFeaturesSection />
      </motion.div>

      {/* Additional Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Card className="border-brand-primary/20 bg-gradient-brand/5">
          <CardContent className="p-6">
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">
                Track Any Shipment
              </h3>
              <p className="text-muted-foreground">
                Enter a tracking number to see detailed shipment information, delivery updates, and estimated arrival times.
              </p>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Enter tracking number (e.g., SH-2024-001)"
                  className="flex-1 px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                />
                <GlassButton>Track</GlassButton>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
