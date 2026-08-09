'use client';

import { cn } from '@/lib/utils';
import { BarChart3, FileText, Package, Radio, Sparkles, Truck, Warehouse } from 'lucide-react';
import { useId } from 'react';

const floatCard =
  'animate-landing-float rounded-2xl border border-white/10 bg-zinc-900/90 p-4 shadow-[0_0_40px_-12px_rgba(99,102,241,0.35)] backdrop-blur-md';

/**
 * Premium hero centerpiece: hub-and-spoke operations diagram, glass layers, ambient motion.
 */
export function HeroPremiumShowcase() {
  const uid = useId().replace(/:/g, '');

  return (
    <div className="relative mx-auto flex min-h-[420px] w-full max-w-[min(100%,920px)] items-center justify-center md:min-h-[480px]">
      {/* Aurora + drift rings */}
      <div
        className="animate-landing-aurora pointer-events-none absolute -inset-[28%] rounded-full bg-[conic-gradient(from_210deg_at_50%_50%,hsl(var(--primary)/0.35)_0deg,transparent_120deg,hsl(var(--accent)/0.25)_220deg,transparent_320deg)] opacity-90 blur-3xl"
        aria-hidden
      />
      <div
        className="animate-landing-drift pointer-events-none absolute inset-[-20%] rounded-full bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.15),transparent_45%),radial-gradient(circle_at_70%_80%,hsl(var(--accent)/0.12),transparent_40%)] opacity-60"
        style={{ animationDuration: '28s' }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 rounded-full border border-white/[0.06]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-[8%] rounded-full border border-dashed border-white/[0.05]"
        aria-hidden
      />

      {/* Main glass stage */}
      <div className="border-border/80 relative z-10 w-full overflow-hidden rounded-[2rem] border bg-gradient-to-b from-zinc-900/95 via-zinc-950/98 to-black shadow-[0_32px_120px_-24px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.06)_inset] ring-1 ring-white/10 backdrop-blur-xl">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        <div className="from-primary/8 to-accent/10 pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-gradient-to-br via-transparent blur-2xl" />

        <div className="relative flex flex-col gap-6 p-6 sm:p-8 md:flex-row md:items-stretch md:gap-8 md:p-10">
          {/* SVG hub */}
          <div className="relative flex flex-1 items-center justify-center md:min-h-[280px]">
            <svg
              viewBox="0 0 400 320"
              className="text-foreground h-auto w-full max-w-[400px] drop-shadow-[0_0_24px_rgba(99,102,241,0.15)]"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden
            >
              <defs>
                <linearGradient id={`${uid}-line`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.5" />
                </linearGradient>
                <linearGradient id={`${uid}-core`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="hsl(var(--primary))" />
                  <stop offset="100%" stopColor="hsl(var(--accent))" />
                </linearGradient>
                <filter id={`${uid}-glow`} x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              {/* spokes */}
              {[
                { x1: 200, y1: 160, x2: 72, y2: 64 },
                { x1: 200, y1: 160, x2: 328, y2: 72 },
                { x1: 200, y1: 160, x2: 64, y2: 248 },
                { x1: 200, y1: 160, x2: 336, y2: 240 },
              ].map((l, i) => (
                <line
                  key={i}
                  x1={l.x1}
                  y1={l.y1}
                  x2={l.x2}
                  y2={l.y2}
                  stroke={`url(#${uid}-line)`}
                  strokeWidth="1.5"
                  strokeOpacity="0.55"
                  strokeLinecap="round"
                />
              ))}
              {/* outer nodes */}
              {[
                { cx: 72, cy: 64, r: 6 },
                { cx: 328, cy: 72, r: 6 },
                { cx: 64, cy: 248, r: 6 },
                { cx: 336, cy: 240, r: 6 },
              ].map((c, i) => (
                <circle
                  key={i}
                  cx={c.cx}
                  cy={c.cy}
                  r={c.r}
                  fill="hsl(var(--primary))"
                  fillOpacity="0.85"
                  filter={`url(#${uid}-glow)`}
                />
              ))}
              {/* core ring */}
              <circle
                cx="200"
                cy="160"
                r="62"
                stroke="white"
                strokeOpacity="0.08"
                strokeWidth="1"
              />
              <circle
                cx="200"
                cy="160"
                r="52"
                stroke={`url(#${uid}-line)`}
                strokeOpacity="0.35"
                strokeWidth="1"
              />
              <circle
                cx="200"
                cy="160"
                r="44"
                fill="hsl(var(--card))"
                stroke="white"
                strokeOpacity="0.12"
              />
              <circle cx="200" cy="160" r="38" fill={`url(#${uid}-core)`} fillOpacity="0.22" />
            </svg>

            {/* Floating metric chips */}
            <div
              className={cn(floatCard, 'absolute top-[6%] left-0 max-w-[140px] sm:left-[2%]')}
              style={{ animationDelay: '0s' }}
            >
              <div className="text-primary mb-1 flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase">
                <Radio className="h-3 w-3" />
                Live
              </div>
              <p className="text-lg font-bold tracking-tight text-white">Quote → Order</p>
              <p className="text-xs text-zinc-300">Single thread of truth</p>
            </div>
            <div
              className={cn(floatCard, 'absolute right-0 bottom-[8%] max-w-[150px] sm:right-[2%]')}
              style={{ animationDelay: '0.6s' }}
            >
              <div className="text-accent mb-1 flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase">
                <Warehouse className="h-3 w-3" />
                Stock
              </div>
              <p className="text-lg font-bold tracking-tight text-white">By branch</p>
              <p className="text-xs text-zinc-300">Transfers &amp; alerts</p>
            </div>
          </div>

          {/* Right stack — product UI abstraction */}
          <div className="border-border/60 flex w-full flex-col justify-center gap-4 rounded-2xl border bg-black/40 p-5 md:max-w-[280px] md:border-l md:bg-zinc-950/50">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold tracking-widest text-zinc-300 uppercase">
                Command view
              </span>
              <Sparkles className="text-primary h-4 w-4 opacity-90" />
            </div>
            <div className="space-y-3">
              {[
                { icon: FileText, label: 'Open quotes', tone: 'text-emerald-400', bar: 'w-[72%]' },
                { icon: Package, label: 'SKU health', tone: 'text-sky-400', bar: 'w-[88%]' },
                { icon: Truck, label: 'In transit', tone: 'text-violet-400', bar: 'w-[56%]' },
                { icon: BarChart3, label: 'Margin pulse', tone: 'text-amber-400', bar: 'w-[64%]' },
              ].map((row) => {
                const RowIcon = row.icon;
                return (
                  <div
                    key={row.label}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 transition-colors hover:bg-white/[0.04]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <RowIcon className={cn('h-4 w-4', row.tone)} />
                        <span className="text-sm font-medium text-zinc-200">{row.label}</span>
                      </div>
                      <span className={cn('text-[10px] font-semibold uppercase', row.tone)}>
                        On track
                      </span>
                    </div>
                    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className={cn(
                          'from-primary to-accent h-full rounded-full bg-gradient-to-r opacity-90',
                          row.bar
                        )}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="border-t border-white/[0.06] pt-3 text-center text-[11px] leading-relaxed text-zinc-300">
              One spine for sales, warehouse &amp; finance — built for equipment wholesalers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
