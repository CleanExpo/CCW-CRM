import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
        // Enterprise B2B Status Variants for Orders/Quotes
        pending:
          "bg-warning-muted text-warning border-warning/20 animate-pulse-soft",
        confirmed: "bg-info-muted text-info border-info/20",
        processing:
          "bg-brand-primary-100 text-brand-primary-700 border-brand-primary-200 dark:bg-brand-primary-950 dark:text-brand-primary-300 dark:border-brand-primary-800",
        shipped:
          "bg-brand-primary-100 text-brand-primary-700 border-brand-primary-200 dark:bg-brand-primary-950 dark:text-brand-primary-300 dark:border-brand-primary-800",
        delivered: "bg-success-muted text-success border-success/20",
        cancelled: "bg-error-muted text-error border-error/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  icon?: LucideIcon;
}

function Badge({ className, variant, icon: Icon, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {Icon && <Icon className="mr-1 h-3 w-3" />}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
