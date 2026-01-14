"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, TrendingUp, AlertTriangle, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface Insight {
  id: string;
  title: string;
  finding: string;
  impact: string;
  recommendation: string;
  priority: "high" | "medium" | "low";
  category: string;
  generated_at: string;
}

interface InsightCardProps {
  insight: Insight;
  defaultExpanded?: boolean;
}

export function InsightCard({ insight, defaultExpanded = false }: InsightCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const priorityConfig = {
    high: {
      color: "bg-red-500",
      textColor: "text-red-700 dark:text-red-400",
      bgColor: "bg-red-50 dark:bg-red-950/20",
      icon: AlertTriangle,
    },
    medium: {
      color: "bg-yellow-500",
      textColor: "text-yellow-700 dark:text-yellow-400",
      bgColor: "bg-yellow-50 dark:bg-yellow-950/20",
      icon: TrendingUp,
    },
    low: {
      color: "bg-blue-500",
      textColor: "text-blue-700 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-950/20",
      icon: Info,
    },
  };

  const config = priorityConfig[insight.priority];
  const PriorityIcon = config.icon;

  const categoryColors: Record<string, string> = {
    sales: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400",
    inventory: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-400",
    customers: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400",
    orders: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-400",
    all: "bg-gray-100 text-gray-800 dark:bg-gray-950 dark:text-gray-400",
  };

  return (
    <Card className={cn("transition-all hover:shadow-md", config.bgColor)}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <PriorityIcon className={cn("h-5 w-5 mt-0.5", config.textColor)} />
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-lg">{insight.title}</CardTitle>
                <Badge variant="outline" className={categoryColors[insight.category] || "bg-gray-100"}>
                  {insight.category}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    "capitalize",
                    insight.priority === "high"
                      ? "border-red-500 text-red-700 dark:text-red-400"
                      : insight.priority === "medium"
                      ? "border-yellow-500 text-yellow-700 dark:text-yellow-400"
                      : "border-blue-500 text-blue-700 dark:text-blue-400"
                  )}
                >
                  {insight.priority}
                </Badge>
              </div>
              <CardDescription className="text-sm text-muted-foreground">
                {new Date(insight.generated_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="shrink-0"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Finding - Always visible */}
        <div>
          <h4 className="text-sm font-semibold mb-1">Finding</h4>
          <p className="text-sm text-muted-foreground">{insight.finding}</p>
        </div>

        {/* Expanded details */}
        {isExpanded && (
          <>
            <div>
              <h4 className="text-sm font-semibold mb-1">Business Impact</h4>
              <p className="text-sm text-muted-foreground">{insight.impact}</p>
            </div>

            <div className={cn("rounded-lg p-4 border-l-4", config.color)}>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Recommended Action
              </h4>
              <p className="text-sm">{insight.recommendation}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
