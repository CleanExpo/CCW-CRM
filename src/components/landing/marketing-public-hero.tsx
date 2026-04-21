import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

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
      <div
        className={cn(
          'mb-5 inline-flex items-center gap-2',
          align === 'center' && 'justify-center'
        )}
      >
        <span
          className="h-px w-8 bg-gradient-to-r from-transparent to-sky-400/80"
          aria-hidden
        />
        <p className="text-xs font-bold tracking-[0.22em] text-sky-300/95 uppercase sm:text-sm">
          {kicker}
        </p>
        <span
          className="h-px w-8 bg-gradient-to-l from-transparent to-indigo-400/70"
          aria-hidden
        />
      </div>
      <h1 className="text-4xl font-extrabold tracking-tight text-balance text-white sm:text-5xl md:text-[3rem] md:leading-[1.08]">
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
      {children ? <div className={cn('mt-10', align === 'center' && 'flex justify-center')}>{children}</div> : null}
    </div>
  );
}
