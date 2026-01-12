"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AnimatedCardProps {
  children: ReactNode;
  className?: string;
  hoverScale?: number;
}

export function AnimatedCard({ children, className, hoverScale = 1.02 }: AnimatedCardProps) {
  return (
    <motion.div
      whileHover={{ scale: hoverScale, y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 25,
      }}
      className={cn("cursor-pointer", className)}
    >
      {children}
    </motion.div>
  );
}
