"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* ============================================
   BORDER BEAM - Animated Gradient Border Glow
   Linear-style animated border effect
   ============================================ */

export interface BorderBeamProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Border width in pixels (default: 1) */
  borderWidth?: number;
  /** Duration of animation in seconds (default: 4) */
  duration?: number;
  /** Color from (default: indigo) */
  colorFrom?: string;
  /** Color via (default: purple) */
  colorVia?: string;
  /** Color to (default: indigo) */
  colorTo?: string;
  /** Delay before animation starts in seconds (default: 0) */
  delay?: number;
}

const BorderBeam = React.forwardRef<HTMLDivElement, BorderBeamProps>(
  (
    {
      className,
      borderWidth = 1,
      duration = 4,
      colorFrom = "#4f46e5",
      colorVia = "#9333ea",
      colorTo = "#4f46e5",
      delay = 0,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn("relative group", className)}
        {...props}
      >
        {/* Animated Gradient Border */}
        <div
          className="absolute -inset-[1px] rounded-[inherit] opacity-0 group-hover:opacity-100 blur-sm transition-opacity duration-500"
          style={{
            background: `linear-gradient(90deg, ${colorFrom}, ${colorVia}, ${colorTo})`,
            backgroundSize: "200% 100%",
            animation: `border-beam ${duration}s ease-in-out ${delay}s infinite`,
            padding: `${borderWidth}px`,
          }}
        />

        {/* Content Container */}
        <div className="relative bg-card rounded-[inherit]">
          {children}
        </div>
      </div>
    );
  }
);

BorderBeam.displayName = "BorderBeam";

export { BorderBeam };
