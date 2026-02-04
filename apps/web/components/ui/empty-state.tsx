import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Package,
  Users,
  FileText,
  ShoppingCart,
  Truck,
  AlertCircle,
  Search,
  Inbox,
  LucideIcon,
} from "lucide-react";

export interface EmptyStateProps {
  /**
   * The type of empty state to display (determines icon and default messages)
   */
  variant?:
    | "products"
    | "customers"
    | "orders"
    | "quotes"
    | "suppliers"
    | "search"
    | "inbox"
    | "error"
    | "generic";

  /**
   * Custom icon to display (overrides variant icon)
   */
  icon?: LucideIcon;

  /**
   * Title text (overrides variant default)
   */
  title?: string;

  /**
   * Description text (overrides variant default)
   */
  description?: string;

  /**
   * Primary action button
   */
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };

  /**
   * Secondary action button
   */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };

  /**
   * Additional className for container
   */
  className?: string;
}

const VARIANT_CONFIG: Record<
  NonNullable<EmptyStateProps["variant"]>,
  {
    icon: LucideIcon;
    title: string;
    description: string;
  }
> = {
  products: {
    icon: Package,
    title: "No products yet",
    description: "Get started by creating your first product. Add product details, pricing, and inventory information.",
  },
  customers: {
    icon: Users,
    title: "No customers yet",
    description: "Start building your customer base. Add customer details and track their orders and quotes.",
  },
  orders: {
    icon: ShoppingCart,
    title: "No orders yet",
    description: "Orders from customers will appear here. Create your first order or wait for customer purchases.",
  },
  quotes: {
    icon: FileText,
    title: "No quotes yet",
    description: "Create professional quotes for your customers. Convert them to orders with a single click.",
  },
  suppliers: {
    icon: Truck,
    title: "No suppliers yet",
    description: "Add your suppliers to manage purchase orders and track inventory from your vendors.",
  },
  search: {
    icon: Search,
    title: "No results found",
    description: "Try adjusting your search terms or filters to find what you're looking for.",
  },
  inbox: {
    icon: Inbox,
    title: "All caught up!",
    description: "There are no items here right now. Check back later for updates.",
  },
  error: {
    icon: AlertCircle,
    title: "Something went wrong",
    description: "We encountered an error loading this data. Please try again or contact support if the problem persists.",
  },
  generic: {
    icon: Inbox,
    title: "Nothing here yet",
    description: "Get started by creating your first item.",
  },
};

export function EmptyState({
  variant = "generic",
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  const config = VARIANT_CONFIG[variant];
  const Icon = icon || config.icon;
  const displayTitle = title || config.title;
  const displayDescription = description || config.description;
  const ActionIcon = action?.icon;

  return (
    <Card className={className}>
      <CardContent className="flex flex-col items-center justify-center py-16 px-4 text-center">
        {/* Icon */}
        <div className="rounded-full bg-muted p-6 mb-6">
          <Icon className="h-12 w-12 text-muted-foreground" />
        </div>

        {/* Title */}
        <h3 className="text-xl font-semibold mb-2">{displayTitle}</h3>

        {/* Description */}
        <p className="text-muted-foreground max-w-md mb-6">{displayDescription}</p>

        {/* Actions */}
        {(action || secondaryAction) && (
          <div className="flex flex-col sm:flex-row gap-3">
            {action && (
              <Button onClick={action.onClick} size="lg">
                {ActionIcon && <ActionIcon className="mr-2 h-4 w-4" />}
                {action.label}
              </Button>
            )}
            {secondaryAction && (
              <Button onClick={secondaryAction.onClick} variant="outline" size="lg">
                {secondaryAction.label}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Compact empty state for smaller containers or list items
 */
export function EmptyStateCompact({
  icon: Icon = Inbox,
  title = "No items",
  description,
  action,
  className,
}: Omit<EmptyStateProps, "variant" | "secondaryAction"> & { icon?: LucideIcon }) {
  const ActionIcon = action?.icon;

  return (
    <div className={`flex flex-col items-center justify-center py-8 px-4 text-center ${className || ""}`}>
      <Icon className="h-8 w-8 text-muted-foreground mb-3" />
      <h4 className="text-sm font-medium mb-1">{title}</h4>
      {description && (
        <p className="text-xs text-muted-foreground mb-4 max-w-xs">{description}</p>
      )}
      {action && (
        <Button onClick={action.onClick} size="sm" variant="outline">
          {ActionIcon && <ActionIcon className="mr-2 h-3 w-3" />}
          {action.label}
        </Button>
      )}
    </div>
  );
}

/**
 * Inline empty state for table rows or list items
 */
export function EmptyStateInline({
  icon: Icon = Inbox,
  message = "No items to display",
  action,
}: {
  icon?: LucideIcon;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}) {
  return (
    <div className="flex items-center justify-center gap-4 py-8 text-sm text-muted-foreground">
      <Icon className="h-5 w-5" />
      <span>{message}</span>
      {action && (
        <Button onClick={action.onClick} size="sm" variant="link" className="h-auto p-0">
          {action.label}
        </Button>
      )}
    </div>
  );
}
