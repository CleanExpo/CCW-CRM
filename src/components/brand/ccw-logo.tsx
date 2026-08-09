import Link from 'next/link';
import { cn } from '@/lib/utils';

const MARK_SIZES = {
  xs: 'h-7 w-7',
  sm: 'h-8 w-8',
  md: 'h-9 w-9',
  lg: 'h-11 w-11',
} as const;

type CcwLogoMarkProps = {
  className?: string;
  size?: keyof typeof MARK_SIZES;
  /** Override when multiple marks share a page (SVG paint-server ids must be unique). */
  idPrefix?: string;
};

/** Clean monogram: open C with a live ops node — sky → indigo. */
export function CcwLogoMark({ className, size = 'md', idPrefix = 'ccw-logo' }: CcwLogoMarkProps) {
  const gradId = `${idPrefix}-grad`;
  const glowId = `${idPrefix}-glow`;

  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(MARK_SIZES[size], 'shrink-0', className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="4" y1="2" x2="36" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38bdf8" />
          <stop offset="0.55" stopColor="#0ea5e9" />
          <stop offset="1" stopColor="#4338ca" />
        </linearGradient>
        <radialGradient
          id={glowId}
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(14 12) rotate(90) scale(22)"
        >
          <stop stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="40" height="40" rx="10" fill={`url(#${gradId})`} />
      <rect width="40" height="40" rx="10" fill={`url(#${glowId})`} />
      <rect
        x="0.5"
        y="0.5"
        width="39"
        height="39"
        rx="9.5"
        stroke="white"
        strokeOpacity="0.2"
        fill="none"
      />

      {/* Open C — single confident stroke */}
      <path
        d="M27.25 12.5C19.2 12.5 13.75 16.85 13.75 20.5C13.75 24.15 19.2 28.5 27.25 28.5"
        stroke="white"
        strokeWidth="2.75"
        strokeLinecap="round"
        fill="none"
      />
      {/* Live ops node at the aperture */}
      <circle cx="27.5" cy="20.5" r="2.35" fill="white" />
      <circle cx="27.5" cy="20.5" r="3.6" stroke="white" strokeOpacity="0.35" fill="none" />
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
        <div className="min-w-0 leading-none">
          <span
            className={cn(
              'block truncate tracking-[-0.03em]',
              size === 'xs' && 'text-[13px] font-semibold',
              size === 'sm' && 'text-sm font-semibold',
              size === 'md' && 'text-[15px] font-semibold sm:text-base',
              size === 'lg' && 'text-lg font-semibold sm:text-xl',
              isLight
                ? 'text-slate-900'
                : 'text-zinc-50 transition-colors group-hover:text-white'
            )}
          >
            {title}
          </span>
          {showSub ? (
            <span
              className={cn(
                'mt-1 block truncate font-medium tracking-wide',
                size === 'lg' ? 'text-xs sm:text-sm' : 'text-[10px] sm:text-[11px]',
                isLight ? 'text-slate-500' : 'text-zinc-500'
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
    'group inline-flex min-w-0 items-center gap-2.5',
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
