"use client";

import { Check, Clock, PackageCheck, Truck, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimelineStep {
  status: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TIMELINE_STEPS: TimelineStep[] = [
  { status: "draft", label: "Draft", icon: Clock },
  { status: "pending", label: "Pending", icon: Clock },
  { status: "confirmed", label: "Confirmed", icon: Check },
  { status: "processing", label: "Processing", icon: PackageCheck },
  { status: "shipped", label: "Shipped", icon: Truck },
  { status: "delivered", label: "Delivered", icon: CheckCircle2 },
];

interface OrderStatusTimelineProps {
  currentStatus: string;
  className?: string;
}

export function OrderStatusTimeline({
  currentStatus,
  className,
}: OrderStatusTimelineProps) {
  // Handle cancelled status separately
  if (currentStatus === "cancelled") {
    return (
      <div className={cn("flex items-center gap-2 p-4 rounded-lg bg-destructive/10", className)}>
        <XCircle className="h-5 w-5 text-destructive" />
        <span className="font-medium text-destructive">Order Cancelled</span>
      </div>
    );
  }

  const currentIndex = TIMELINE_STEPS.findIndex((step) => step.status === currentStatus);

  return (
    <div className={cn("relative", className)}>
      {/* Timeline Steps */}
      <div className="flex items-center justify-between">
        {TIMELINE_STEPS.map((step, index) => {
          const Icon = step.icon;
          const isCompleted = index <= currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <div key={step.status} className="flex flex-col items-center flex-1">
              {/* Step Circle */}
              <div className="relative z-10 flex items-center justify-center">
                <div
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all",
                    isCompleted
                      ? "bg-primary border-primary text-primary-foreground"
                      : "bg-background border-muted-foreground text-muted-foreground",
                    isCurrent && "ring-4 ring-primary/20 scale-110"
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
              </div>

              {/* Step Label */}
              <div className="mt-2 text-center">
                <p
                  className={cn(
                    "text-sm font-medium transition-colors",
                    isCompleted ? "text-foreground" : "text-muted-foreground",
                    isCurrent && "font-bold"
                  )}
                >
                  {step.label}
                </p>
              </div>

              {/* Connecting Line */}
              {index < TIMELINE_STEPS.length - 1 && (
                <div
                  className={cn(
                    "absolute top-5 h-0.5 transition-all",
                    isCompleted ? "bg-primary" : "bg-muted-foreground/30"
                  )}
                  style={{
                    left: `${((index + 0.5) / TIMELINE_STEPS.length) * 100}%`,
                    width: `${(1 / TIMELINE_STEPS.length) * 100}%`,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Progress Bar Background */}
      <div className="absolute top-5 left-0 right-0 h-0.5 bg-muted-foreground/10 -z-10" />
    </div>
  );
}
