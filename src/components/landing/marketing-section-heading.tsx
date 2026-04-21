import { cn } from '@/lib/utils';

export function MarketingSectionHeading({
  kicker,
  title,
  description,
  className,
}: {
  kicker: string;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn('mx-auto max-w-3xl text-center', className)}>
      <div className="mb-6 flex items-center justify-center gap-3">
        <span
          className="h-px w-10 bg-gradient-to-r from-transparent to-sky-400/70 sm:w-14"
          aria-hidden
        />
        <p className="text-xs font-bold tracking-[0.22em] text-sky-300/95 uppercase sm:text-sm">
          {kicker}
        </p>
        <span
          className="h-px w-10 bg-gradient-to-l from-transparent to-indigo-400/60 sm:w-14"
          aria-hidden
        />
      </div>
      <h2 className="text-3xl font-extrabold tracking-tight text-balance text-white sm:text-4xl md:text-[2.75rem] md:leading-[1.12]">
        {title}
      </h2>
      {description ? (
        <p className="mt-6 text-base leading-relaxed text-pretty text-zinc-400 sm:text-lg md:text-xl">
          {description}
        </p>
      ) : null}
    </div>
  );
}
