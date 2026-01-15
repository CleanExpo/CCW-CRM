"use client";

import { Check, Package, Truck, Home, Clock } from "lucide-react";

interface OrderStatusTimelineProps {
  order: {
    status: string;
    order_date: string;
    shipped_date?: string;
    estimated_delivery_date?: string;
  };
}

interface TimelineStep {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  completed: boolean;
  timestamp: string | null;
  isCurrent: boolean;
}

export function OrderStatusTimeline({ order }: OrderStatusTimelineProps) {
  // Map order statuses to timeline steps
  const statusOrder = ["draft", "pending", "confirmed", "processing", "shipped", "delivered"];
  const currentStatusIndex = statusOrder.indexOf(order.status);

  const steps: TimelineStep[] = [
    {
      label: "Order Confirmed",
      icon: Check,
      completed: currentStatusIndex >= 2, // confirmed or later
      timestamp: order.order_date,
      isCurrent: order.status === "confirmed",
    },
    {
      label: "Processing",
      icon: Package,
      completed: currentStatusIndex >= 3, // processing or later
      timestamp: null,
      isCurrent: order.status === "processing",
    },
    {
      label: "Shipped",
      icon: Truck,
      completed: currentStatusIndex >= 4, // shipped or later
      timestamp: order.shipped_date || null,
      isCurrent: order.status === "shipped",
    },
    {
      label: "Delivered",
      icon: Home,
      completed: order.status === "delivered",
      timestamp: order.status === "delivered" ? order.estimated_delivery_date || null : null,
      isCurrent: order.status === "delivered",
    },
  ];

  // Format timestamp to Australian format (DD/MM/YYYY h:mm AM/PM)
  const formatTimestamp = (timestamp: string | null): string => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;

    return `${day}/${month}/${year} ${displayHours}:${minutes} ${ampm}`;
  };

  return (
    <div className="relative mt-6">
      {/* Vertical line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

      <div className="space-y-6">
        {steps.map((step, index) => {
          const Icon = step.icon;

          return (
            <div key={index} className="relative flex items-start gap-4">
              {/* Icon circle */}
              <div
                className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full ${
                  step.completed
                    ? "bg-green-500 text-white"
                    : step.isCurrent
                    ? "bg-blue-500 text-white animate-pulse"
                    : "bg-gray-200 text-gray-400"
                }`}
              >
                {step.isCurrent && !step.completed ? (
                  <Clock className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 pt-0.5">
                <p
                  className={`font-medium ${
                    step.completed || step.isCurrent ? "text-gray-900" : "text-gray-400"
                  }`}
                >
                  {step.label}
                  {step.isCurrent && !step.completed && (
                    <span className="ml-2 text-xs text-blue-600 font-semibold">
                      (In Progress)
                    </span>
                  )}
                </p>
                {step.timestamp && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatTimestamp(step.timestamp)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Special handling for cancelled orders */}
      {order.status === "cancelled" && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800 font-medium">
            ⚠️ This order has been cancelled
          </p>
        </div>
      )}
    </div>
  );
}
