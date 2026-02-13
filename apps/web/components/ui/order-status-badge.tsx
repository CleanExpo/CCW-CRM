import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/../../packages/shared/src/types/orders";

/**
 * Color mapping for order statuses with dark mode support
 * Uses opacity-based backgrounds for better visual hierarchy
 */
const statusStyles: Record<OrderStatus, string> = {
  draft: "bg-gray-500/10 text-gray-700 border-gray-300 dark:bg-gray-500/20 dark:text-gray-300 dark:border-gray-700",
  pending: "bg-yellow-500/10 text-yellow-700 border-yellow-300 dark:bg-yellow-500/20 dark:text-yellow-300 dark:border-yellow-700",
  confirmed: "bg-blue-500/10 text-blue-700 border-blue-300 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-700",
  processing: "bg-purple-500/10 text-purple-700 border-purple-300 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-700",
  shipped: "bg-indigo-500/10 text-indigo-700 border-indigo-300 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-700",
  delivered: "bg-green-500/10 text-green-700 border-green-300 dark:bg-green-500/20 dark:text-green-300 dark:border-green-700",
  cancelled: "bg-red-500/10 text-red-700 border-red-300 dark:bg-red-500/20 dark:text-red-300 dark:border-red-700",
};

/**
 * Helper function to get status-specific styles
 * Exported for potential reuse in other components
 */
export function getStatusStyles(status: OrderStatus): string {
  return statusStyles[status] || statusStyles.draft;
}

export interface OrderStatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The order status to display */
  status: OrderStatus;
  /** Optional icon to display before the status text */
  icon?: React.ElementType;
  /** Additional CSS classes */
  className?: string;
}

/**
 * OrderStatusBadge - Displays order status with color-coded badges
 *
 * Color scheme:
 * - draft: Gray
 * - pending: Yellow
 * - confirmed: Blue
 * - processing: Purple
 * - shipped: Indigo
 * - delivered: Green
 * - cancelled: Red
 *
 * @example
 * ```tsx
 * <OrderStatusBadge status="shipped" />
 * <OrderStatusBadge status="delivered" icon={CheckIcon} />
 * ```
 */
export function OrderStatusBadge({
  status,
  icon,
  className,
  ...props
}: OrderStatusBadgeProps) {
  return (
    <Badge
      className={cn(getStatusStyles(status), "capitalize", className)}
      icon={icon}
      {...props}
    >
      {status}
    </Badge>
  );
}
