"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PulseNotificationProps {
  children: ReactNode;
  show?: boolean;
  className?: string;
}

export function PulseNotification({ children, show = true, className }: PulseNotificationProps) {
  if (!show) return <>{children}</>;

  return (
    <div className="relative inline-flex">
      {children}
      <motion.span
        className={cn(
          "absolute -top-1 -right-1 flex h-3 w-3",
          className
        )}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 20 }}
      >
        <motion.span
          className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.75, 0, 0.75],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive" />
      </motion.span>
    </div>
  );
}
