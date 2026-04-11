import { cn } from '@/lib/utils';

/** Ambient hero backdrop — matches landing hero energy. */
export function MarketingHeroBackdrop({ className }: { className?: string }) {
  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden>
      <div className="animate-landing-aurora absolute -inset-[40%] opacity-80 blur-3xl bg-[conic-gradient(from_210deg_at_50%_50%,hsl(var(--primary)/0.28)_0deg,transparent_120deg,hsl(var(--accent)/0.2)_220deg,transparent_320deg)]" />
      <div
        className="animate-landing-drift absolute inset-[-25%] opacity-50 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.14),transparent_45%),radial-gradient(circle_at_70%_80%,hsl(var(--accent)/0.1),transparent_40%)]"
        style={{ animationDuration: '28s' }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_-10%,hsl(var(--primary)/0.18),transparent_55%)]" />
    </div>
  );
}

/** Product page — spine / hub illustration. */
export function ProductSpineGraphic({ className }: { className?: string }) {
  const id = 'pspine';
  return (
    <div className={cn('relative', className)}>
      <div className="absolute inset-0 rounded-[2rem] border border-white/10 bg-gradient-to-b from-zinc-900/90 to-black shadow-[0_32px_100px_-28px_rgba(0,0,0,0.9)] ring-1 ring-white/10" />
      <svg viewBox="0 0 520 360" className="relative z-10 h-auto w-full" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <defs>
          <linearGradient id={`${id}-g`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(199 89% 48%)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="hsl(271 81% 56%)" stopOpacity="0.7" />
          </linearGradient>
          <filter id={`${id}-b`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect x="210" y="120" width="100" height="120" rx="16" fill="hsl(var(--card))" stroke="url(#pspine-g)" strokeWidth="1.5" opacity="0.95" />
        <text x="260" y="188" textAnchor="middle" className="fill-zinc-200 text-[11px] font-bold" style={{ fontSize: 11 }}>
          CCW CORE
        </text>
        {[
          { x: 80, y: 80, label: 'Catalog' },
          { x: 380, y: 70, label: 'Quotes' },
          { x: 60, y: 260, label: 'Warehouse' },
          { x: 400, y: 250, label: 'Finance' },
        ].map((n, i) => (
          <g key={n.label}>
            <line
              x1="260"
              y1="180"
              x2={n.x + 40}
              y2={n.y + 24}
              stroke="url(#pspine-g)"
              strokeWidth="1.2"
              strokeOpacity="0.45"
            />
            <rect x={n.x} y={n.y} width="88" height="48" rx="10" fill="hsl(var(--card))" stroke="white" strokeOpacity="0.1" />
            <text x={n.x + 44} y={n.y + 30} textAnchor="middle" className="fill-zinc-400" style={{ fontSize: 10 }}>
              {n.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/** Glass UI mockup strip — reusable “dashboard” preview. */
export function UiMockupStrip({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/95 to-zinc-950 p-5 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.85)] ring-1 ring-white/10',
        className
      )}
    >
      <div className="mb-4 flex items-center gap-2 border-b border-white/10 pb-3">
        <div className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
        <div className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
        <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
        <div className="ml-auto h-2 w-24 rounded-full bg-white/10" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-2">
          <div className="h-2 w-3/4 rounded bg-white/15" />
          <div className="h-2 w-full rounded bg-white/10" />
          <div className="h-2 w-5/6 rounded bg-white/10" />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="h-16 rounded-lg bg-sky-500/15 ring-1 ring-sky-500/30" />
            <div className="h-16 rounded-lg bg-violet-500/15 ring-1 ring-violet-500/30" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-10 rounded-lg bg-white/5" />
          <div className="h-10 rounded-lg bg-white/5" />
          <div className="h-10 rounded-lg bg-gradient-to-br from-sky-500/30 to-indigo-600/30" />
        </div>
      </div>
    </div>
  );
}

/** How it works — stepped path SVG. */
export function RolloutPathGraphic({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 640 200" className={cn('h-auto w-full text-sky-400/90', className)} fill="none" aria-hidden>
      <path
        d="M40 100 C 140 40, 200 160, 320 100 S 500 40, 600 100"
        stroke="url(#pathGrad)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="8 6"
        opacity="0.6"
      />
      <defs>
        <linearGradient id="pathGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgb(56, 189, 248)" />
          <stop offset="100%" stopColor="rgb(167, 139, 250)" />
        </linearGradient>
      </defs>
      {[80, 220, 360, 500].map((x, i) => (
        <circle key={i} cx={x} cy={i % 2 === 0 ? 88 : 112} r="10" fill="rgb(24 24 27)" stroke="rgb(56, 189, 248)" strokeWidth="1.5" />
      ))}
    </svg>
  );
}

/** Pricing — decorative glow panel behind cards. */
export function PricingGlowPanel({ className }: { className?: string }) {
  return (
    <div className={cn('pointer-events-none absolute inset-0', className)} aria-hidden>
      <div className="absolute left-1/2 top-1/2 h-[min(80vw,720px)] w-[min(80vw,720px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,hsl(var(--primary)/0.15),transparent_65%)] blur-3xl" />
    </div>
  );
}
