import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

type MarketingPublicHeroProps = {
  kicker: string;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
  align?: 'center' | 'left';
  children?: ReactNode;
};

/**
 * Consistent page title block for public marketing routes (beyond the home page).
 */
export function MarketingPublicHero({
  kicker,
  title,
  description,
  className,
  align = 'center',
  children,
}: MarketingPublicHeroProps) {
  return (
    <div
      className={cn(
        align === 'center' ? 'text-center' : 'text-left',
        'animate-marketing-reveal motion-reduce:animate-none',
        className
      )}
    >
      <p className="mb-4 text-[12px] font-semibold tracking-[0.22em] text-sky-400/90 uppercase">
        {kicker}
      </p>
      <h1
        className="text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.08] font-semibold tracking-tight text-balance text-white"
        style={{
          fontFamily: 'var(--font-marketing-display), var(--font-marketing-body), sans-serif',
        }}
      >
        {title}
      </h1>
      {description ? (
        <div
          className={cn(
            'mt-6 text-lg leading-relaxed text-zinc-300 md:text-xl',
            align === 'center' && 'mx-auto max-w-2xl'
          )}
        >
          {description}
        </div>
      ) : null}
      {children ? (
        <div className={cn('mt-10', align === 'center' && 'flex justify-center')}>{children}</div>
      ) : null}
    </div>
  );
}
