import { Package, Users, ShoppingCart, DollarSign, FileText, LayoutGrid } from 'lucide-react';

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
  { key: 'total_products' as const, label: 'Products', icon: Package },
  { key: 'total_customers' as const, label: 'Customers', icon: Users },
  { key: 'active_orders' as const, label: 'Active Orders', icon: ShoppingCart },
  { key: 'total_revenue_this_month' as const, label: 'Revenue (Month)', icon: DollarSign },
  { key: 'pending_quotes' as const, label: 'Open Quotes', icon: FileText },
  { key: 'product_categories' as const, label: 'Categories', icon: LayoutGrid },
];

const inner = 'w-[min(94vw,1728px)] mx-auto px-[clamp(1rem,3.5vw,2.75rem)]';

function formatStat(value: number, opts?: { prefix?: string; compact?: boolean }): string {
  const prefix = opts?.prefix ?? '';
  if (opts?.compact && value >= 1000) {
    return `${prefix}${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K`;
  }
  return `${prefix}${new Intl.NumberFormat('en-AU').format(Math.round(value))}`;
}

/**
 * Public stats strip — server component on purpose.
 * Framer motion here previously pulled the full motion runtime onto the landing
 * JS path even though this region streams below the hero (LCP). Static numbers
 * keep the metric honest without the bundle cost.
 */
export function LiveStatsBar({ stats }: LiveStatsBarProps) {
  if (!stats) return null;

  const revenueNum = parseFloat(stats.total_revenue_this_month) || 0;

  return (
    <section className="border-y border-white/[0.08] bg-gradient-to-b from-zinc-950 to-black py-14 md:py-16">
      <div className={inner}>
        <div className="mb-10 flex items-center justify-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </span>
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-300">
            Live platform data
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5 lg:grid-cols-6">
          {statItems.map((item) => {
            const Icon = item.icon;
            const isRevenue = item.key === 'total_revenue_this_month';
            const display = isRevenue
              ? formatStat(revenueNum, { prefix: '$', compact: true })
              : formatStat(stats[item.key] as number);

            return (
              <div
                key={item.key}
                className="rounded-2xl border border-white/[0.08] bg-zinc-900/60 p-5 text-center shadow-md backdrop-blur-sm transition hover:border-primary/25 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="mx-auto mb-3 w-fit rounded-xl border border-primary/20 bg-primary/10 p-2.5">
                  <Icon className="text-primary h-4 w-4" />
                </div>
                <div className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                  {display}
                </div>
                <div className="mt-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-300">
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
