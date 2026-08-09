'use client';

import { cn } from '@/lib/utils';
import { useEffect, useRef, useState, type ReactNode } from 'react';

type MarketingRevealProps = {
  children: ReactNode;
  className?: string;
  /** Delay in ms after enter — keep short. */
  delayMs?: number;
};

/**
 * Below-fold reveal only. Transform + opacity after intersection —
 * never wrap the LCP hero headline in this.
 */
export function MarketingReveal({ children, className, delayMs = 0 }: MarketingRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        'transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
        className
      )}
      style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}
