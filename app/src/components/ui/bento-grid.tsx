import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/* ============================================
   BENTO GRID - Linear-Style Responsive Grid
   ============================================ */

// Grid Container
const bentoGridVariants = cva(
  "grid w-full auto-rows-auto",
  {
    variants: {
      columns: {
        2: "grid-cols-1 md:grid-cols-2",
        3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
        4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
      },
      gap: {
        sm: "gap-3",      // 12px
        md: "gap-4",      // 16px - Linear standard
        lg: "gap-6",      // 24px
      },
    },
    defaultVariants: {
      columns: 3,
      gap: "md",
    },
  }
);

export interface BentoGridProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof bentoGridVariants> {}

const BentoGrid = React.forwardRef<HTMLDivElement, BentoGridProps>(
  ({ className, columns, gap, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(bentoGridVariants({ columns, gap }), className)}
        {...props}
      />
    );
  }
);
BentoGrid.displayName = "BentoGrid";

// Bento Card
const bentoCardVariants = cva(
  "relative rounded-xl p-6 transition-all duration-300",
  {
    variants: {
      variant: {
        default: "bg-card border border-border shadow-md hover:shadow-lg",
        glass: "bg-surface-glass backdrop-blur-lg border border-white/10 shadow-lg hover:shadow-xl",
        gradient: "relative overflow-hidden before:absolute before:inset-0 before:rounded-xl before:p-[1px] before:bg-gradient-brand",
        elevated: "bg-card shadow-xl border border-border hover:shadow-2xl hover:-translate-y-1",
      },
      span: {
        1: "col-span-1",
        2: "col-span-1 md:col-span-2",
        3: "col-span-1 md:col-span-2 lg:col-span-3",
        4: "col-span-1 md:col-span-2 lg:col-span-4",
      },
      glowOnHover: {
        true: "hover:shadow-glow",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      span: 1,
      glowOnHover: false,
    },
  }
);

export interface BentoCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof bentoCardVariants> {
  asChild?: boolean;
}

const BentoCard = React.forwardRef<HTMLDivElement, BentoCardProps>(
  ({ className, variant, span, glowOnHover, children, ...props }, ref) => {
    const content = (
      <div
        ref={ref}
        className={cn(bentoCardVariants({ variant, span, glowOnHover }), className)}
        {...props}
      >
        {variant === "gradient" ? (
          <>
            <div className="relative z-10 rounded-xl bg-card p-6">
              {children}
            </div>
          </>
        ) : (
          children
        )}
      </div>
    );

    return content;
  }
);
BentoCard.displayName = "BentoCard";

// Bento Card Header
const BentoCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5", className)}
    {...props}
  />
));
BentoCardHeader.displayName = "BentoCardHeader";

// Bento Card Title
const BentoCardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
BentoCardTitle.displayName = "BentoCardTitle";

// Bento Card Description
const BentoCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
BentoCardDescription.displayName = "BentoCardDescription";

// Bento Card Content
const BentoCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("pt-4", className)}
    {...props}
  />
));
BentoCardContent.displayName = "BentoCardContent";

// Bento Card Footer
const BentoCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center pt-4", className)}
    {...props}
  />
));
BentoCardFooter.displayName = "BentoCardFooter";

export {
  BentoGrid,
  BentoCard,
  BentoCardHeader,
  BentoCardTitle,
  BentoCardDescription,
  BentoCardContent,
  BentoCardFooter,
  bentoCardVariants,
};
