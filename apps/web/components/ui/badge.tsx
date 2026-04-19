import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

import { cn } from '@/lib/utils';

const variantIconMap: Record<string, React.ElementType> = {
  success: CheckCircle,
  destructive: XCircle,
  pending: AlertCircle,
};

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80',
        success: 'border-transparent bg-success text-success-foreground shadow hover:bg-success/80',
        pending: 'border-transparent bg-warning text-warning-foreground shadow hover:bg-warning/80',
        processing: 'border-transparent bg-info text-info-foreground shadow hover:bg-info/80',
        outline: 'text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {
  icon?: React.ElementType;
  withIcon?: boolean;
}

function Badge({ className, variant, icon: IconProp, withIcon, children, ...props }: BadgeProps) {
  const autoIcon = variant ? variantIconMap[variant] : undefined;
  const Icon = IconProp ?? (withIcon ? autoIcon : undefined);
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {Icon ? <Icon className="mr-1 h-3 w-3" /> : null}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
