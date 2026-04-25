'use client';

import { OPERATIONS_ACCENT_STYLES, type OperationsAccent } from '@/lib/operations/ui';
import { cn } from '@/lib/utils';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import Link from 'next/link';

export type { OperationsAccent } from '@/lib/operations/ui';

export type OperationsBreadcrumb = { label: string; href?: string };

export interface OperationsPageHeaderProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  sectionLabel?: string;
  /** Colour story for hero orbs, bar, and icon — each operations route should pick one. */
  accent?: OperationsAccent;
  breadcrumbs?: OperationsBreadcrumb[];
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
}

function OperationsHeroArt({ strokeClass }: { strokeClass: string }) {
  return (
    <svg
      className={cn(
        'pointer-events-none absolute -right-6 bottom-0 h-[min(100%,320px)] w-[min(92vw,340px)] translate-y-[8%] sm:top-1/2 sm:right-4 sm:h-[280px] sm:w-[300px] sm:translate-y-[-45%]',
        strokeClass
      )}
      viewBox="0 0 300 260"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        opacity="0.9"
        d="M218 32L268 62V142L218 172L168 142V62L218 32Z"
        stroke="currentColor"
        strokeWidth="0.75"
      />
      <path
        opacity="0.55"
        d="M48 88L118 128V208L48 248L-22 208V128L48 88Z"
        stroke="currentColor"
        strokeWidth="0.65"
      />
      <circle cx="92" cy="48" r="56" stroke="currentColor" strokeWidth="0.5" opacity="0.35" />
      <path
        d="M12 180 Q120 120 288 200"
        stroke="currentColor"
        strokeWidth="0.85"
        strokeLinecap="round"
        opacity="0.45"
      />
      <path
        d="M32 40 L120 40 M120 40 L120 112 M120 112 L32 112 M32 112 L32 40"
        stroke="currentColor"
        strokeWidth="0.4"
        opacity="0.25"
      />
    </svg>
  );
}

export function OperationsPageHeader({
  title,
  description,
  icon: Icon,
  sectionLabel = 'Operations',
  accent = 'ocean',
  breadcrumbs,
  actions,
  meta,
  className,
}: OperationsPageHeaderProps) {
  const pal = OPERATIONS_ACCENT_STYLES[accent];

  return (
    <div
      className={cn(
        'border-border/70 bg-card/90 relative overflow-hidden rounded-2xl border shadow-lg backdrop-blur-md sm:rounded-3xl',
        '[.operations-route-scope_&]:from-card [.operations-route-scope_&]:via-card/95 [.operations-route-scope_&]:to-card/90 [.operations-route-scope_&]:border-white/[0.14] [.operations-route-scope_&]:bg-gradient-to-br',
        '[.operations-route-scope_&]:shadow-[0_20px_50px_-24px_rgba(0,0,0,0.55)]',
        className
      )}
    >
      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-95',
          pal.bar
        )}
        aria-hidden
      />

      <div
        className={cn(
          'pointer-events-none absolute top-1/2 -right-24 h-[min(100vw,420px)] w-[min(100vw,420px)] -translate-y-1/2 rounded-full blur-3xl',
          pal.orbA
        )}
        aria-hidden
      />
      <div
        className={cn(
          'pointer-events-none absolute -top-28 -left-28 h-72 w-72 rounded-full blur-3xl',
          pal.orbB
        )}
        aria-hidden
      />

      <div
        className="pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,black_55%,transparent)] opacity-[0.4] dark:opacity-[0.22]"
        style={{
          backgroundImage: `linear-gradient(to right, hsl(var(--foreground) / 0.055) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--foreground) / 0.055) 1px, transparent 1px)`,
          backgroundSize: '28px 28px',
        }}
        aria-hidden
      />

      <div
        className="from-primary/[0.08] pointer-events-none absolute inset-0 bg-gradient-to-br via-transparent to-transparent"
        aria-hidden
      />

      <OperationsHeroArt strokeClass={pal.art} />

      <div className="relative z-[1] flex flex-col gap-5 p-6 sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:p-8">
        <div className="max-w-[min(100%,42rem)] min-w-0 space-y-3 sm:max-w-[min(100%,36rem)]">
          <div className="flex items-center gap-2">
            <span className="ring-primary/40 inline-flex h-1.5 w-1.5 rounded-full bg-gradient-to-br from-white/80 to-white/30 shadow-[0_0_12px_hsl(var(--primary)/0.65)] ring-2" />
            <p className="text-muted-foreground dark:text-foreground/60 text-[0.65rem] font-semibold tracking-[0.22em] uppercase">
              {sectionLabel}
            </p>
          </div>
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav
              className="text-muted-foreground dark:text-foreground/70 flex flex-wrap items-center gap-1 text-xs"
              aria-label="Breadcrumb"
            >
              {breadcrumbs.map((c, i) => (
                <span key={`${c.label}-${i}`} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 opacity-45" />}
                  {c.href ? (
                    <Link
                      href={c.href}
                      className="hover:text-foreground rounded-md px-0.5 underline-offset-4 transition-colors hover:underline"
                    >
                      {c.label}
                    </Link>
                  ) : (
                    <span className="text-foreground font-medium">{c.label}</span>
                  )}
                </span>
              ))}
            </nav>
          )}
          <div className="flex items-start gap-4">
            {Icon && (
              <div
                className={cn(
                  'relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-inner ring-2 ring-inset',
                  pal.iconBg,
                  pal.iconRing
                )}
                aria-hidden
              >
                <Icon className={cn('relative z-[1] h-6 w-6', pal.iconFg)} />
              </div>
            )}
            <div className="min-w-0 pt-0.5">
              <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                {title}
              </h1>
              <p className="text-muted-foreground dark:text-foreground/78 mt-2 max-w-2xl text-sm leading-relaxed text-pretty">
                {description}
              </p>
              {meta}
            </div>
          </div>
        </div>
        {actions && (
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

export function OperationsPageLayout({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('relative mx-auto', className)}>
      <div
        className="bg-primary/[0.07] dark:bg-primary/[0.09] pointer-events-none absolute top-32 -left-20 h-56 w-56 rounded-full blur-3xl"
        aria-hidden
      />
      <div
        className="bg-primary/[0.05] dark:bg-primary/[0.06] pointer-events-none absolute -right-12 bottom-8 h-64 w-64 rounded-full blur-3xl"
        aria-hidden
      />
      <div className="relative z-0">{children}</div>
    </div>
  );
}
