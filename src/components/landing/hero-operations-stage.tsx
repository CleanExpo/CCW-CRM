'use client';

import { cn } from '@/lib/utils';
import { useState } from 'react';

const VIEWS = [
  {
    id: 'quotes',
    label: 'Quotes',
    title: 'Quote Q-1842 · Metro Facilities',
    rows: [
      { sku: 'TM-450X', name: 'Truckmount 450X', qty: '2', status: 'Reserved', tone: 'ok' },
      { sku: 'WD-12L', name: 'Wand kit 12L', qty: '4', status: 'In stock', tone: 'ok' },
      { sku: 'FIL-90', name: 'Filter pack 90', qty: '12', status: 'Backorder', tone: 'warn' },
    ],
    meta: ['Branch · Brisbane DC', 'Margin visible', 'Ready to convert'],
  },
  {
    id: 'stock',
    label: 'Stock',
    title: 'On-hand by branch',
    rows: [
      { sku: 'BNE', name: 'Brisbane DC', qty: '1,240', status: 'Healthy', tone: 'ok' },
      { sku: 'SYD', name: 'Sydney West', qty: '860', status: 'Transfer in', tone: 'info' },
      { sku: 'MEL', name: 'Melbourne South', qty: '410', status: 'Reorder', tone: 'warn' },
    ],
    meta: ['Live Cin7 sync', 'Transfers queued', 'Alerts on threshold'],
  },
  {
    id: 'fulfil',
    label: 'Fulfilment',
    title: 'Today’s despatch board',
    rows: [
      { sku: 'SO-9921', name: 'CleanPro Au', qty: '8 ln', status: 'Picking', tone: 'info' },
      { sku: 'SO-9924', name: 'Harbour Hire', qty: '3 ln', status: 'Packed', tone: 'ok' },
      { sku: 'SO-9930', name: 'Coastal Maint.', qty: '11 ln', status: 'Hold', tone: 'warn' },
    ],
    meta: ['Same-day cut-off 2pm', 'Carrier slots', 'Finance notified'],
  },
] as const;

type Tone = 'ok' | 'warn' | 'info';

function toneClass(tone: Tone) {
  if (tone === 'ok') return 'text-emerald-400/90';
  if (tone === 'warn') return 'text-amber-400/90';
  return 'text-sky-400/90';
}

/**
 * Interactive product stage for the hero — the visual story is the product itself.
 */
export function HeroOperationsStage() {
  const [active, setActive] = useState(0);
  const view = VIEWS[active] ?? VIEWS[0];

  return (
    <div className="relative w-full">
      {/* Atmosphere — restrained, purposeful */}
      <div
        className="pointer-events-none absolute -inset-x-8 -top-16 -bottom-8 bg-[radial-gradient(ellipse_70%_55%_at_50%_0%,rgba(14,165,233,0.16),transparent_70%)]"
        aria-hidden
      />

      <div className="relative overflow-hidden border border-white/[0.08] bg-[#0a0a0e] shadow-[0_40px_120px_-48px_rgba(0,0,0,0.95)]">
        {/* Window chrome */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3 sm:px-5">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5" aria-hidden>
              <span className="h-2 w-2 rounded-full bg-white/15" />
              <span className="h-2 w-2 rounded-full bg-white/15" />
              <span className="h-2 w-2 rounded-full bg-white/15" />
            </div>
            <p className="text-[11px] font-medium tracking-wide text-zinc-400 uppercase">
              CCW Online · Operations
            </p>
          </div>
          <p className="hidden text-[11px] text-zinc-400 sm:block">Australia · Live workspace</p>
        </div>

        <div className="grid xl:grid-cols-[168px_1fr]">
          {/* Rail — only when the stage has horizontal room */}
          <aside className="hidden border-r border-white/[0.06] bg-black/40 p-4 xl:block">
            <p className="text-[10px] font-semibold tracking-[0.18em] text-zinc-400 uppercase">
              Workspace
            </p>
            <ul className="mt-4 space-y-1 text-[13px] text-zinc-400">
              {['Dashboard', 'Quotes', 'Orders', 'Inventory', 'Customers', 'Finance'].map(
                (item, i) => (
                  <li
                    key={item}
                    className={cn(
                      'px-2.5 py-2 transition-colors',
                      i === 1 ? 'bg-white/[0.06] text-zinc-100' : 'hover:text-zinc-300'
                    )}
                  >
                    {item}
                  </li>
                )
              )}
            </ul>
          </aside>

          {/* Main panel */}
          <div className="min-w-0 p-4 sm:p-6 md:p-8">
            <div
              className="flex flex-wrap gap-1 border-b border-white/[0.06] pb-3"
              role="tablist"
              aria-label="Operations view"
            >
              {VIEWS.map((v, i) => (
                <button
                  key={v.id}
                  type="button"
                  role="tab"
                  aria-selected={active === i}
                  onClick={() => setActive(i)}
                  className={cn(
                    'px-3.5 py-2 text-[13px] font-medium transition-colors',
                    active === i
                      ? 'bg-sky-500/15 text-sky-200'
                      : 'text-zinc-400 hover:text-zinc-200'
                  )}
                >
                  {v.label}
                </button>
              ))}
            </div>

            <div
              key={view.id}
              className="animate-marketing-stage mt-6 motion-reduce:animate-none"
              role="tabpanel"
            >
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3
                    className="text-lg font-semibold tracking-tight text-white sm:text-xl"
                    style={{ fontFamily: 'var(--font-marketing-display), system-ui' }}
                  >
                    {view.title}
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-zinc-400">
                    {view.meta.map((m) => (
                      <span key={m}>{m}</span>
                    ))}
                  </div>
                </div>
                <span className="inline-flex items-center gap-2 text-[11px] font-medium tracking-wide text-emerald-400/90 uppercase">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 motion-reduce:animate-none" />
                  Synced
                </span>
              </div>

              <div className="mt-6 overflow-hidden border border-white/[0.06]">
                <div className="grid grid-cols-[1fr_2fr_0.7fr_1fr] gap-2 border-b border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[10px] font-semibold tracking-[0.14em] text-zinc-400 uppercase sm:px-4">
                  <span>Code</span>
                  <span>Line</span>
                  <span className="text-right">Qty</span>
                  <span className="text-right">Status</span>
                </div>
                {view.rows.map((row) => (
                  <div
                    key={row.sku}
                    className="grid grid-cols-[1fr_2fr_0.7fr_1fr] gap-2 border-b border-white/[0.04] px-3 py-3 text-[13px] last:border-b-0 sm:px-4"
                  >
                    <span className="font-medium text-zinc-300 tabular-nums">{row.sku}</span>
                    <span className="truncate text-zinc-400">{row.name}</span>
                    <span className="text-right text-zinc-200 tabular-nums">{row.qty}</span>
                    <span className={cn('text-right font-medium', toneClass(row.tone))}>
                      {row.status}
                    </span>
                  </div>
                ))}
              </div>

              {/* Progress strip — quiet motion */}
              <div className="mt-6 flex items-center gap-4">
                <div className="h-px flex-1 overflow-hidden bg-white/[0.06]">
                  <div className="animate-marketing-progress h-px w-2/3 bg-gradient-to-r from-sky-500/80 to-transparent motion-reduce:animate-none" />
                </div>
                <span className="text-[11px] text-zinc-400 tabular-nums">Pipeline 67%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HeroOperationsStage;
