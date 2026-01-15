"use client";

import { motion } from "framer-motion";
import { ReactNode, useEffect, useState } from "react";

interface ShakeOnErrorProps {
  children: ReactNode;
  error?: boolean;
  className?: string;
}

export function ShakeOnError({ children, error = false, className }: ShakeOnErrorProps) {
  const [shouldShake, setShouldShake] = useState(false);

  useEffect(() => {
    if (error) {
      setShouldShake(true);
      const timer = setTimeout(() => setShouldShake(false), 500);
      return () => clearTimeout(timer);
    }
  }, [error]);

  return (
    <motion.div
      className={className}
      animate={shouldShake ? {
        x: [0, -10, 10, -10, 10, 0],
        transition: { duration: 0.4 }
      } : {}}
    >
      {children}
    </motion.div>
  );
}
