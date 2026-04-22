'use client';

import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, DollarSign, FileText, Package, ShoppingCart, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DashboardStatMetrics = {
  total_revenue_this_month: string;
  active_orders: number;
  total_products: number;
  total_customers: number;
  low_stock_alerts: number;
  pending_quotes: number;
};

export type DashboardStatTileConfig = {
  key: keyof DashboardStatMetrics;
  label: string;
  foot: string;
  icon: LucideIcon;
  format: 'currency' | 'number';
  tone?: 'default' | 'danger' | 'sky';
};

export const DASHBOARD_STAT_TILES: DashboardStatTileConfig[] = [
  {
    key: 'total_revenue_this_month',
    label: 'Total revenue',
    foot: 'This month from delivered orders',
    icon: DollarSign,
    format: 'currency',
    tone: 'sky',
  },
  {
    key: 'active_orders',
    label: 'Active orders',
    foot: 'In progress across branches',
    icon: ShoppingCart,
    format: 'number',
  },
  {
    key: 'total_products',
    label: 'Equipment SKUs',
    foot: 'Active catalogue lines',
    icon: Package,
    format: 'number',
  },
  {
    key: 'total_customers',
    label: 'Customers',
    foot: 'Active trading accounts',
    icon: Users,
    format: 'number',
  },
  {
    key: 'low_stock_alerts',
    label: 'Low stock',
    foot: 'Items at or below reorder',
    icon: AlertTriangle,
    format: 'number',
    tone: 'danger',
  },
  {
    key: 'pending_quotes',
    label: 'Pending quotes',
    foot: 'Awaiting customer response',
    icon: FileText,
    format: 'number',
  },
];

const tileAccent: Record<NonNullable<DashboardStatTileConfig['tone']>, string> = {
  default: 'from-sky-500/35 via-white/12 to-indigo-600/30',
  danger: 'from-red-500/35 via-orange-500/15 to-amber-600/25',
  sky: 'from-cyan-500/30 via-sky-500/20 to-indigo-600/30',
};

function StatTile({
  label,
  valueNode,
  foot,
  icon: Icon,
  tone,
}: {
  label: string;
  valueNode: React.ReactNode;
  foot: string;
  icon: LucideIcon;
  tone: NonNullable<DashboardStatTileConfig['tone']>;
}) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl p-px shadow-lg shadow-black/30',
        'bg-gradient-to-br',
        tileAccent[tone]
      )}
    >
      <div className="relative flex h-full min-h-[7.5rem] flex-col gap-2 rounded-[15px] border border-white/[0.07] bg-zinc-950/92 p-4 backdrop-blur-sm transition-colors group-hover:bg-zinc-900/90 sm:p-5">
        <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-sky-500/10 blur-2xl transition-opacity group-hover:opacity-90" />
        <div className="relative flex items-center gap-2 text-zinc-300">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] ring-1 ring-white/10">
            <Icon className="h-4 w-4 text-sky-300" aria-hidden />
          </span>
          <span className="text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">{label}</span>
        </div>
        <div className="relative text-2xl font-bold tracking-tight text-white tabular-nums sm:text-3xl">
          {valueNode}
        </div>
        <p className="relative mt-auto text-xs leading-snug text-zinc-500">{foot}</p>
      </div>
    </div>
  );
}

type DashboardStatTilesProps = {
  metrics: DashboardStatMetrics | null;
  formatCurrency: (value: number) => string;
  tiles?: DashboardStatTileConfig[];
};

export function DashboardStatTiles({
  metrics,
  formatCurrency,
  tiles = DASHBOARD_STAT_TILES,
}: DashboardStatTilesProps) {
  if (!metrics) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {tiles.map((t) => {
        const raw = metrics[t.key];
        const value =
          t.format === 'currency'
            ? formatCurrency(parseFloat(String(raw || '0')))
            : (raw as number);
        const tone: NonNullable<DashboardStatTileConfig['tone']> =
          t.key === 'low_stock_alerts' ? 'danger' : (t.tone ?? 'default');
        return (
          <StatTile
            key={t.key}
            label={t.label}
            foot={t.foot}
            icon={t.icon}
            tone={tone}
            valueNode={
              t.format === 'currency' ? (
                <span className="bg-gradient-to-r from-sky-200 via-white to-indigo-200 bg-clip-text text-transparent">
                  {value}
                </span>
              ) : tone === 'danger' ? (
                <span className="text-red-400">{value}</span>
              ) : (
                value
              )
            }
          />
        );
      })}
    </div>
  );
}

/** Relative volume bars — CRM-style quick scan. */
export function DashboardOperationalMix({ metrics }: { metrics: DashboardStatMetrics | null }) {
  if (!metrics) return null;
  const rows = [
    { label: 'Active orders', value: metrics.active_orders },
    { label: 'Equipment SKUs', value: metrics.total_products },
    { label: 'Customers', value: metrics.total_customers },
    { label: 'Pending quotes', value: metrics.pending_quotes },
  ];
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">Operational mix</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map((row) => (
          <div key={row.label} className="space-y-2">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="text-zinc-500">{row.label}</span>
              <span className="font-semibold tabular-nums text-zinc-100">{row.value}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-white/[0.05]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 via-indigo-500 to-violet-500 opacity-90 transition-[width] duration-500"
                style={{ width: `${Math.min(100, (row.value / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
