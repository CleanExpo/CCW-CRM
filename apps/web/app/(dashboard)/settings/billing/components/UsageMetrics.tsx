"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, Package, Sparkles } from "lucide-react";
import type { Subscription } from "@/lib/api/billing";

interface UsageMetricsProps {
  subscription: Subscription;
  currentUsage?: {
    locations: number;
    users: number;
    products: number;
    aiQuotes: number;
  };
}

export function UsageMetrics({ subscription, currentUsage }: UsageMetricsProps) {
  const usage = currentUsage || {
    locations: 0,
    users: 0,
    products: 0,
    aiQuotes: 0,
  };

  const getUsagePercent = (current: number, max: number): number => {
    if (max === -1) return 0; // Unlimited
    return Math.min((current / max) * 100, 100);
  };

  const formatLimit = (limit: number): string => {
    if (limit === -1) return "Unlimited";
    return limit.toLocaleString();
  };

  const getUsageColor = (percent: number): string => {
    if (percent >= 90) return "text-destructive";
    if (percent >= 75) return "text-orange-500";
    return "text-primary";
  };

  const metrics = [
    {
      icon: Building2,
      label: "Locations",
      current: usage.locations,
      max: subscription.max_locations,
      color: "bg-blue-500",
    },
    {
      icon: Users,
      label: "Team Members",
      current: usage.users,
      max: subscription.max_users,
      color: "bg-green-500",
    },
    {
      icon: Package,
      label: "Products",
      current: usage.products,
      max: subscription.max_products,
      color: "bg-purple-500",
    },
    {
      icon: Sparkles,
      label: "AI Quotes (This Month)",
      current: usage.aiQuotes,
      max: subscription.max_ai_quotes_per_month,
      color: "bg-orange-500",
      enabled: subscription.has_ai_features,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => {
        if (metric.enabled === false) return null;

        const percent = getUsagePercent(metric.current, metric.max);
        const Icon = metric.icon;

        return (
          <Card key={metric.label}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Icon className="h-4 w-4 text-muted-foreground" />
                {metric.max !== -1 && percent >= 90 && (
                  <Badge variant="destructive" className="text-xs">
                    Near Limit
                  </Badge>
                )}
              </div>
              <CardTitle className="text-sm font-medium">{metric.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-baseline gap-1">
                  <span className={`text-2xl font-bold ${getUsageColor(percent)}`}>
                    {metric.current.toLocaleString()}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    / {formatLimit(metric.max)}
                  </span>
                </div>

                {metric.max !== -1 && (
                  <div className="space-y-1">
                    <Progress value={percent} className="h-1.5" />
                    <p className="text-xs text-muted-foreground">{percent.toFixed(0)}% used</p>
                  </div>
                )}

                {metric.max === -1 && (
                  <p className="text-xs text-muted-foreground">No limit</p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
