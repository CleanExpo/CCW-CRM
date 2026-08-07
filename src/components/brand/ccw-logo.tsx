import Link from 'next/link';
import { cn } from '@/lib/utils';

const MARK_SIZES = {
  xs: 'h-7 w-7',
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
} as const;

type CcwLogoMarkProps = {
  className?: string;
  size?: keyof typeof MARK_SIZES;
  /** Override when multiple marks share a page (SVG paint-server ids must be unique). */
  idPrefix?: string;
};

/** Premium mark: orbital C with operational tiers — equipment ERP spine. */
export function CcwLogoMark({ className, size = 'md', idPrefix = 'ccw-logo' }: CcwLogoMarkProps) {
  const gradId = `${idPrefix}-grad`;
  const shineId = `${idPrefix}-shine`;

  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(MARK_SIZES[size], 'shrink-0', className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="6" y1="4" x2="34" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7dd3fc" />
          <stop offset="0.45" stopColor="#0ea5e9" />
          <stop offset="1" stopColor="#4f46e5" />
        </linearGradient>
        <linearGradient id={shineId} x1="8" y1="6" x2="28" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill={`url(#${gradId})`} />
      <rect
        width="40"
        height="40"
        rx="11"
        fill={`url(#${shineId})`}
        className="pointer-events-none"
      />
      <rect
        x="0.5"
        y="0.5"
        width="39"
        height="39"
        rx="10.5"
        stroke="white"
        strokeOpacity="0.22"
        fill="none"
      />
      <path
        d="M27.5 11.5C18.5 11.5 13 16.75 13 20.25C13 23.75 18.5 29 27.5 29"
        stroke="white"
        strokeWidth="2.35"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M16.5 16.25h7.75" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <path d="M16.5 20.25h10.25" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <path d="M16.5 24.25h6.5" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <circle cx="28.25" cy="20.25" r="2.1" fill="white" />
      <path
        d="M26.75 20.25h-2.5"
        stroke="white"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeOpacity="0.85"
      />
    </svg>
  );
}

export type CcwLogoProps = {
  variant?: 'mark' | 'compact' | 'full';
  size?: keyof typeof MARK_SIZES;
  showTagline?: boolean;
  tagline?: string;
  title?: string;
  subtitle?: string;
  className?: string;
  href?: string;
  /** Light surfaces (portal, supplier) vs dark app shell */
  theme?: 'dark' | 'light';
  idPrefix?: string;
};

export function CcwLogo({
  variant = 'compact',
  size = 'md',
  showTagline,
  tagline = 'Equipment supplier operations',
  title = 'CCW Online',
  subtitle,
  className,
  href,
  theme = 'dark',
  idPrefix,
}: CcwLogoProps) {
  const isLight = theme === 'light';
  const showWordmark = variant !== 'mark';
  const showSub =
    variant === 'full' && (showTagline ?? true) && (subtitle ?? tagline);

  const content = (
    <>
      <span
        className={cn(
          'relative flex shrink-0 items-center justify-center transition duration-300',
          MARK_SIZES[size],
          !isLight && 'group-hover:scale-[1.03] group-active:scale-[0.98]'
        )}
      >
        <CcwLogoMark className="h-full w-full" idPrefix={idPrefix} />
      </span>
      {showWordmark ? (
        <div className="min-w-0 leading-tight">
          <span
            className={cn(
              'block truncate font-bold tracking-tight',
              size === 'xs' && 'text-sm',
              size === 'sm' && 'text-sm',
              size === 'md' && 'text-base sm:text-lg',
              size === 'lg' && 'text-lg sm:text-xl',
              isLight
                ? 'text-slate-900'
                : 'text-zinc-100 transition-colors group-hover:text-white'
            )}
          >
            {title}
          </span>
          {showSub ? (
            <span
              className={cn(
                'block truncate font-medium',
                size === 'lg' ? 'text-xs sm:text-sm' : 'text-[11px] sm:text-xs',
                isLight ? 'text-slate-500' : 'text-zinc-400'
              )}
            >
              {subtitle ?? tagline}
            </span>
          ) : null}
        </div>
      ) : null}
    </>
  );

  const rootClass = cn(
    'group inline-flex min-w-0 items-center gap-2.5 font-semibold',
    className
  );

  if (href) {
    return (
      <Link href={href} className={rootClass}>
        {content}
      </Link>
    );
  }

  return <span className={rootClass}>{content}</span>;
}
