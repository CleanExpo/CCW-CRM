import { cn } from '@/lib/utils';

export function MarketingSectionHeading({
  index,
  kicker,
  title,
  description,
  className,
  align = 'left',
}: {
  /** Editorial index e.g. "02" */
  index?: string;
  /** Legacy label — rendered as a quiet overline */
  kicker?: string;
  title: string;
  description?: string;
  className?: string;
  align?: 'left' | 'center';
}) {
  const overline = index ?? kicker;

  return (
    <div
      className={cn(
        align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl text-left',
        className
      )}
    >
      {overline ? (
        <p className="mb-4 text-[12px] font-semibold tracking-[0.22em] text-sky-400/90 uppercase">
          {overline}
        </p>
      ) : null}
      <h2
        className="text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.12] font-semibold tracking-tight text-balance text-white"
        style={{
          fontFamily: 'var(--font-marketing-display), var(--font-marketing-body), sans-serif',
        }}
      >
        {title}
      </h2>
      {description ? (
        <p className="mt-5 text-base leading-relaxed text-pretty text-zinc-400 md:text-lg">
          {description}
        </p>
      ) : null}
    </div>
  );
}
