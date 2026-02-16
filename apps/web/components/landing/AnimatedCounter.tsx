"use client";

import { useEffect, useRef } from "react";
import {
  useMotionValue,
  useSpring,
  useInView,
  useTransform,
  motion,
} from "framer-motion";

interface AnimatedCounterProps {
  /** Target number to count up to */
  value: number;
  /** Text before the number (e.g. "$") */
  prefix?: string;
  /** Text after the number (e.g. "+") */
  suffix?: string;
  /** Animation duration in seconds */
  duration?: number;
  /** Format as compact (e.g. 125K instead of 125,000) */
  compact?: boolean;
}

export function AnimatedCounter({
  value,
  prefix = "",
  suffix = "",
  duration = 1.5,
  compact = false,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, {
    damping: 40,
    stiffness: 100,
    duration: duration * 1000,
  });
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  const display = useTransform(springValue, (latest) => {
    const rounded = Math.round(latest);
    if (compact && rounded >= 1000) {
      return `${prefix}${(rounded / 1000).toFixed(rounded >= 10000 ? 0 : 1)}K${suffix}`;
    }
    return `${prefix}${new Intl.NumberFormat("en-AU").format(rounded)}${suffix}`;
  });

  useEffect(() => {
    if (isInView) {
      motionValue.set(value);
    }
  }, [isInView, value, motionValue]);

  return <motion.span ref={ref}>{display}</motion.span>;
}
