'use client';

import { Activity, Layers3, Radio, Sparkles } from 'lucide-react';
import { marketingShell } from '@/components/landing/marketing-shell';
import { cn } from '@/lib/utils';

const PREVIEW_METRICS = [
  { label: 'Products', short: 'SKU catalog' },
  { label: 'Customers', short: 'Accounts' },
  { label: 'Active orders', short: 'Pipeline' },
  { label: 'Revenue (MTD)', short: 'Finance' },
  { label: 'Open quotes', short: 'Sales' },
  { label: 'Warehouses', short: 'Branches' },
] as const;

/**
 * Hero follow-up when public stats are not available yet: rich graphic + preview strip.
 * Replace body with `<LiveStatsBar stats={stats} />` once `/api/public/stats` is wired.
 */
export function LandingOperationsPulsePlaceholder() {
  return (
    <section
      className="relative overflow-hidden border-y border-white/[0.08] bg-gradient-to-b from-[#050508] via-zinc-950/98 to-black"
      aria-labelledby="ops-pulse-heading"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_-10%,rgba(56,189,248,0.09),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-sky-500/20 to-transparent" />

      <div className={cn(marketingShell, 'relative py-16 md:py-20 lg:py-24')}>
        {/* Illustration — system working / data spine */}
        <div className="relative mx-auto max-w-4xl">
          <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-sky-500/10 via-transparent to-indigo-600/10 blur-2xl md:-inset-8" />
          <div className="relative overflow-hidden rounded-[1.75rem] border border-white/[0.1] bg-gradient-to-b from-zinc-900/90 via-zinc-950/95 to-black p-1 shadow-[0_40px_100px_-48px_rgba(0,0,0,0.95)] ring-1 ring-white/[0.06]">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            <div className="relative px-6 pb-8 pt-10 sm:px-10 sm:pb-10 sm:pt-12">
              <div className="mb-8 flex flex-col items-center text-center sm:mb-10">
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold tracking-[0.2em] text-emerald-200/95 uppercase">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  </span>
                  System pulse
                </span>
                <p id="ops-pulse-heading" className="mt-4 max-w-lg text-lg font-semibold tracking-tight text-white md:text-xl">
                  One spine—catalog, orders, and branches—kept in sync
                </p>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-400">
                  When your deployment exposes public metrics, live counters appear here so visitors
                  see real throughput—not a static brochure.
                </p>
              </div>

              <OperationsPulseGraphic className="mx-auto w-full max-w-3xl" />

              <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs text-zinc-400">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-3 py-1.5 ring-1 ring-white/[0.06]">
                  <Layers3 className="h-3.5 w-3.5 text-sky-400" aria-hidden />
                  Unified data layer
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-3 py-1.5 ring-1 ring-white/[0.06]">
                  <Radio className="h-3.5 w-3.5 text-violet-400" aria-hidden />
                  Ready for live sync
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-3 py-1.5 ring-1 ring-white/[0.06]">
                  <Activity className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
                  Operational health
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Preview metric strip — same grid rhythm as LiveStatsBar, placeholder for later */}
        <div className="relative mx-auto mt-14 max-w-[min(94vw,1728px)] md:mt-16">
          <div className="mb-6 flex items-center justify-center gap-2">
            <Sparkles className="h-4 w-4 text-sky-400/80" aria-hidden />
            <p className="text-center text-[11px] font-bold tracking-[0.28em] text-zinc-400 uppercase">
              Preview — live KPI strip
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:gap-4">
            {PREVIEW_METRICS.map(({ label, short }) => (
              <div
                key={label}
                className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-zinc-900/50 p-4 text-center shadow-inner shadow-black/40 ring-1 ring-white/[0.04] transition hover:border-sky-500/20 hover:bg-zinc-900/70"
              >
                <div
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(56,189,248,0.06) 0%, transparent 50%)',
                  }}
                />
                <div className="relative">
                  <div className="shimmer mx-auto mb-3 h-8 w-16 overflow-hidden rounded-md opacity-60" />
                  <div className="font-mono text-lg font-bold tabular-nums text-zinc-400">—</div>
                  <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    {label}
                  </div>
                  <div className="mt-0.5 text-[10px] text-zinc-400">{short}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed text-zinc-400">
            Connect your data layer and expose{' '}
            <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-zinc-400">
              /api/public/stats
            </code>{' '}
            — this strip will animate with real products, customers, orders, and revenue the same way
            your team sees them inside the app.
          </p>
        </div>
      </div>
    </section>
  );
}

function OperationsPulseGraphic({ className }: { className?: string }) {
  const uid = 'ops-pulse';
  return (
    <svg
      viewBox="0 0 720 280"
      className={cn('h-auto w-full text-sky-400/90', className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id={`${uid}-line`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgb(56, 189, 248)" stopOpacity="0.85" />
          <stop offset="100%" stopColor="rgb(129, 140, 248)" stopOpacity="0.45" />
        </linearGradient>
        <linearGradient id={`${uid}-core`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgb(56, 189, 248)" />
          <stop offset="100%" stopColor="rgb(99, 102, 241)" />
        </linearGradient>
        <filter id={`${uid}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Soft panel */}
      <rect
        x="24"
        y="32"
        width="672"
        height="216"
        rx="20"
        fill="rgb(24 24 27 / 0.5)"
        stroke="rgb(255 255 255 / 0.08)"
        strokeWidth="1"
      />

      {/* Mini chart bars — throughput */}
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <rect
          key={i}
          x={120 + i * 72}
          y={180 - (18 + (i % 4) * 12)}
          width="10"
          height={18 + (i % 4) * 12}
          rx="3"
          fill={`url(#${uid}-line)`}
          opacity={0.35 + (i % 3) * 0.1}
        />
      ))}

      {/* Hub */}
      <circle cx="360" cy="120" r="44" stroke="rgb(255 255 255 / 0.1)" strokeWidth="1" />
      <circle
        cx="360"
        cy="120"
        r="36"
        stroke={`url(#${uid}-line)`}
        strokeWidth="1.5"
        opacity="0.5"
        className="animate-pulse"
      />
      <circle cx="360" cy="120" r="28" fill={`url(#${uid}-core)`} fillOpacity="0.25" />
      <text
        x="360"
        y="124"
        textAnchor="middle"
        fill="rgb(228 228 231)"
        style={{ fontSize: 11, fontWeight: 700 }}
      >
        CCW CORE
      </text>

      {/* Spokes + nodes */}
      {[
        { x1: 360, y1: 120, x2: 140, y2: 72, label: 'Catalog' },
        { x1: 360, y1: 120, x2: 580, y2: 72, label: 'Quotes' },
        { x1: 360, y1: 120, x2: 120, y2: 180, label: 'Warehouse' },
        { x1: 360, y1: 120, x2: 600, y2: 180, label: 'Finance' },
      ].map((L, i) => (
        <g key={i}>
          <line
            x1={L.x1}
            y1={L.y1}
            x2={L.x2}
            y2={L.y2}
            stroke={`url(#${uid}-line)`}
            strokeWidth="1.2"
            strokeOpacity="0.4"
            strokeLinecap="round"
          />
          <rect
            x={L.x2 - 44}
            y={L.y2 - 16}
            width="88"
            height="32"
            rx="8"
            fill="rgb(39 39 42 / 0.9)"
            stroke="rgb(255 255 255 / 0.1)"
            strokeWidth="1"
          />
          <text
            x={L.x2}
            y={L.y2 + 4}
            textAnchor="middle"
            fill="rgb(161 161 170)"
            style={{ fontSize: 10, fontWeight: 600 }}
          >
            {L.label}
          </text>
        </g>
      ))}

      <circle cx="360" cy="120" r="6" fill="rgb(56, 189, 248)" filter={`url(#${uid}-glow)`} />

      {/* Flow label */}
      <text
        x="360"
        y="248"
        textAnchor="middle"
        fill="rgb(113 113 122)"
        style={{ fontSize: 10 }}
      >
        Data flows through one spine — metrics reflect real operational load
      </text>
    </svg>
  );
}
