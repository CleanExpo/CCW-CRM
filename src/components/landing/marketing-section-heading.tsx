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
      <p className="text-xs font-bold tracking-[0.22em] text-sky-400 uppercase drop-shadow-[0_0_20px_rgba(56,189,248,0.35)] sm:text-sm">
        {kicker}
      </p>
      <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-balance text-white sm:text-4xl md:text-[2.75rem] md:leading-[1.12]">
        {title}
      </h2>
      {description ? (
        <p className="mt-5 text-base leading-relaxed text-pretty text-zinc-300 sm:text-lg md:text-xl">
          {description}
        </p>
      ) : null}
    </div>
  );
}
