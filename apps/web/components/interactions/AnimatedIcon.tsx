"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface AnimatedIconProps {
  children: ReactNode;
  className?: string;
  hoverRotate?: number;
  hoverScale?: number;
}

export function AnimatedIcon({
  children,
  className,
  hoverRotate = 0,
  hoverScale = 1.1
}: AnimatedIconProps) {
  return (
    <motion.span
      className={className}
      whileHover={{
        scale: hoverScale,
        rotate: hoverRotate,
        transition: { type: "spring", stiffness: 400, damping: 10 }
      }}
      whileTap={{ scale: 0.9 }}
    >
      {children}
    </motion.span>
  );
}
