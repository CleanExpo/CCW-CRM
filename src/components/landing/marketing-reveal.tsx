'use client';

import { cn } from '@/lib/utils';
import { useEffect, useRef, useState, type ReactNode } from 'react';

type MarketingRevealProps = {
  children: ReactNode;
  className?: string;
  /** Delay in ms after enter — keep short. */
  delayMs?: number;
  /**
   * Element to render. Use `li` when the reveal sits directly inside a list: a
   * wrapper `div` between `ol` and `li` looks identical but breaks list
   * semantics, so screen readers stop announcing the item count. axe reports it
   * as `list` + `listitem`.
   */
  as?: 'div' | 'li';
};

/**
 * Below-fold reveal only. Transform + opacity after intersection —
 * never wrap the LCP hero headline in this.
 */
export function MarketingReveal({
  children,
  className,
  delayMs = 0,
  as: Tag = 'div',
}: MarketingRevealProps) {
  const ref = useRef<HTMLDivElement & HTMLLIElement>(null);
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
    <Tag
      ref={ref}
      // Makes the revealed state observable from outside React. The accessibility gate has to
      // know whether this content is actually visible before it scans: axe-core treats an
      // `opacity: 0` ancestor as hidden, so scanning before the effect runs examines nothing and
      // reports a clean page. Without a signal to wait on, that gate goes quietly blind on a
      // slow-hydrating runner — the exact failure the reduced-motion case exists to prevent.
      data-revealed={visible ? 'true' : 'false'}
      className={cn(
        'transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
        className
      )}
      style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}

export default MarketingReveal;
