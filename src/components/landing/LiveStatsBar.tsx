import { marketingShell } from '@/components/landing/marketing-shell';

export interface PublicStats {
  total_products: number;
  total_customers: number;
  active_orders: number;
  pending_quotes: number;
  total_revenue_this_month: string;
  low_stock_alerts: number;
  product_categories: number;
  warehouse_count: number;
  fetched_at: string;
}

interface LiveStatsBarProps {
  stats: PublicStats | null;
}

const statItems = [
  { key: 'total_products' as const, label: 'Products' },
  { key: 'total_customers' as const, label: 'Customers' },
  { key: 'active_orders' as const, label: 'Active orders' },
  { key: 'total_revenue_this_month' as const, label: 'Revenue (month)' },
  { key: 'pending_quotes' as const, label: 'Open quotes' },
  { key: 'product_categories' as const, label: 'Categories' },
];

function formatStat(value: number, opts?: { prefix?: string; compact?: boolean }): string {
  const prefix = opts?.prefix ?? '';
  if (opts?.compact && value >= 1000) {
    return `${prefix}${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K`;
  }
  return `${prefix}${new Intl.NumberFormat('en-AU').format(Math.round(value))}`;
}

/**
 * Public stats strip — server component.
 * Editorial metric row aligned with the redesigned landing system.
 */
export function LiveStatsBar({ stats }: LiveStatsBarProps) {
  if (!stats) return null;

  const revenueNum = parseFloat(stats.total_revenue_this_month) || 0;

  return (
    <section className="border-y border-white/[0.06] bg-[#08080c] py-12 md:py-14">
      <div className={marketingShell}>
        <div className="mb-8 flex items-center gap-3">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/50 motion-reduce:animate-none" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className="text-[11px] font-semibold tracking-[0.22em] text-zinc-500 uppercase">
            Live platform data
          </span>
        </div>

        <div className="grid grid-cols-2 gap-px overflow-hidden border border-white/[0.06] bg-white/[0.06] sm:grid-cols-3 lg:grid-cols-6">
          {statItems.map((item) => {
            const isRevenue = item.key === 'total_revenue_this_month';
            const display = isRevenue
              ? formatStat(revenueNum, { prefix: '$', compact: true })
              : formatStat(stats[item.key] as number);

            return (
              <div key={item.key} className="bg-[#08080c] px-4 py-6 text-left sm:px-5">
                <div
                  className="text-2xl font-semibold tracking-tight text-white tabular-nums md:text-[1.75rem]"
                  style={{
                    fontFamily:
                      'var(--font-marketing-display), var(--font-marketing-body), sans-serif',
                  }}
                >
                  {display}
                </div>
                <div className="mt-2 text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
                  {item.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
