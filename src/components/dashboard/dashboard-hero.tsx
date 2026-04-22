import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type DashboardHeroProps = {
  eyebrow: string;
  title: ReactNode;
  description?: string;
  aside?: ReactNode;
  className?: string;
};

export function DashboardHero({ eyebrow, title, description, aside, className }: DashboardHeroProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between lg:gap-10',
        className
      )}
    >
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="h-px w-6 bg-gradient-to-r from-transparent to-sky-400/80" aria-hidden />
          <p className="text-xs font-bold tracking-[0.2em] text-sky-300/95 uppercase">{eyebrow}</p>
          <span className="h-px w-6 bg-gradient-to-l from-transparent to-indigo-400/70" aria-hidden />
        </div>
        <div className="space-y-3">
          <h1 className="text-balance text-3xl font-extrabold tracking-tight text-white sm:text-4xl md:text-[2.35rem] md:leading-[1.12]">
            {title}
          </h1>
          {description ? (
            <p className="max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">{description}</p>
          ) : null}
        </div>
      </div>
      {aside ? <div className="w-full shrink-0 lg:max-w-sm">{aside}</div> : null}
    </div>
  );
}
