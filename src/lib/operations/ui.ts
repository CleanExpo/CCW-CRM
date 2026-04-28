/**
 * Shared layout and status styles for Operations module pages.
 * Uses semantic opacity tokens so text stays readable in light and dark themes.
 */

/** Hero header colourways — orbs, bar, and icon treatment for operations page headers. */
export const OPERATIONS_ACCENT_STYLES = {
  ocean: {
    orbA: 'bg-sky-400/40 dark:bg-sky-500/[0.22]',
    orbB: 'bg-teal-400/35 dark:bg-teal-500/[0.14]',
    iconBg: 'bg-gradient-to-br from-sky-500/35 to-teal-500/30 dark:from-sky-400/25 dark:to-teal-500/18',
    iconRing: 'ring-sky-500/45 dark:ring-sky-400/35',
    iconFg: 'text-sky-950 dark:text-sky-50',
    bar: 'from-sky-500 via-teal-500 to-cyan-400',
    art: 'text-sky-600/25 dark:text-sky-400/[0.18]',
  },
  dawn: {
    orbA: 'bg-amber-400/45 dark:bg-amber-500/[0.2]',
    orbB: 'bg-orange-400/35 dark:bg-orange-500/[0.12]',
    iconBg: 'bg-gradient-to-br from-amber-500/35 to-orange-500/28 dark:from-amber-400/22 dark:to-orange-500/15',
    iconRing: 'ring-amber-500/45 dark:ring-amber-400/35',
    iconFg: 'text-amber-950 dark:text-amber-50',
    bar: 'from-amber-500 via-orange-500 to-rose-400',
    art: 'text-amber-600/25 dark:text-amber-400/[0.18]',
  },
  aurora: {
    orbA: 'bg-violet-500/35 dark:bg-violet-500/[0.22]',
    orbB: 'bg-fuchsia-400/30 dark:bg-fuchsia-500/[0.14]',
    iconBg: 'bg-gradient-to-br from-violet-500/35 to-fuchsia-500/28 dark:from-violet-400/22 dark:to-fuchsia-500/16',
    iconRing: 'ring-violet-500/45 dark:ring-violet-400/35',
    iconFg: 'text-violet-950 dark:text-violet-50',
    bar: 'from-violet-500 via-fuchsia-500 to-indigo-400',
    art: 'text-violet-600/25 dark:text-violet-400/[0.2]',
  },
  forest: {
    orbA: 'bg-emerald-400/40 dark:bg-emerald-500/[0.2]',
    orbB: 'bg-lime-400/30 dark:bg-lime-500/[0.12]',
    iconBg: 'bg-gradient-to-br from-emerald-500/35 to-lime-500/25 dark:from-emerald-400/22 dark:to-lime-500/14',
    iconRing: 'ring-emerald-500/45 dark:ring-emerald-400/35',
    iconFg: 'text-emerald-950 dark:text-emerald-50',
    bar: 'from-emerald-500 via-lime-500 to-green-400',
    art: 'text-emerald-600/25 dark:text-emerald-400/[0.18]',
  },
  lagoon: {
    orbA: 'bg-cyan-400/40 dark:bg-cyan-500/[0.2]',
    orbB: 'bg-blue-500/30 dark:bg-blue-600/[0.14]',
    iconBg: 'bg-gradient-to-br from-cyan-500/35 to-blue-600/28 dark:from-cyan-400/22 dark:to-blue-600/16',
    iconRing: 'ring-cyan-500/45 dark:ring-cyan-400/35',
    iconFg: 'text-cyan-950 dark:text-cyan-50',
    bar: 'from-cyan-500 via-blue-500 to-indigo-400',
    art: 'text-cyan-600/25 dark:text-cyan-400/[0.18]',
  },
  pulse: {
    orbA: 'bg-rose-400/40 dark:bg-rose-500/[0.2]',
    orbB: 'bg-pink-400/32 dark:bg-pink-500/[0.12]',
    iconBg: 'bg-gradient-to-br from-rose-500/35 to-pink-500/28 dark:from-rose-400/22 dark:to-pink-500/15',
    iconRing: 'ring-rose-500/45 dark:ring-rose-400/35',
    iconFg: 'text-rose-950 dark:text-rose-50',
    bar: 'from-rose-500 via-pink-500 to-fuchsia-400',
    art: 'text-rose-600/25 dark:text-rose-400/[0.18]',
  },
  mint: {
    orbA: 'bg-emerald-400/35 dark:bg-emerald-500/[0.18]',
    orbB: 'bg-teal-400/30 dark:bg-teal-500/[0.12]',
    iconBg: 'bg-gradient-to-br from-emerald-500/32 to-teal-500/26 dark:from-emerald-400/18 dark:to-teal-500/14',
    iconRing: 'ring-emerald-500/40 dark:ring-emerald-400/32',
    iconFg: 'text-emerald-950 dark:text-emerald-50',
    bar: 'from-emerald-500 via-teal-500 to-cyan-400',
    art: 'text-emerald-600/22 dark:text-emerald-400/[0.16]',
  },
  horizon: {
    orbA: 'bg-indigo-400/38 dark:bg-indigo-500/[0.2]',
    orbB: 'bg-slate-400/28 dark:bg-slate-500/[0.12]',
    iconBg: 'bg-gradient-to-br from-indigo-500/35 to-slate-500/25 dark:from-indigo-400/20 dark:to-slate-500/14',
    iconRing: 'ring-indigo-500/45 dark:ring-indigo-400/35',
    iconFg: 'text-indigo-950 dark:text-indigo-50',
    bar: 'from-indigo-500 via-slate-500 to-blue-400',
    art: 'text-indigo-600/25 dark:text-indigo-400/[0.18]',
  },
} as const;

export type OperationsAccent = keyof typeof OPERATIONS_ACCENT_STYLES;

/** Main list / terminal shell — soft shadow and diagonal sheen for depth. */
export const opHeroSurfaceClass =
  'relative overflow-hidden shadow-md shadow-black/[0.04] before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(125deg,hsl(var(--primary)/0.08)_0%,transparent_46%,hsl(var(--primary)/0.04)_100%)] dark:shadow-black/30';

export const opCardClass =
  'border-border bg-card text-card-foreground shadow-sm shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.04)] dark:shadow-[inset_0_1px_0_0_hsl(var(--primary)/0.07)] [.operations-route-scope_&]:border-white/10 [.operations-route-scope_&]:bg-card [.inventory-route-scope_&]:border-white/10 [.inventory-route-scope_&]:bg-card [.crm-route-scope_&]:border-white/10 [.crm-route-scope_&]:bg-card [.workshop-route-scope_&]:border-white/10 [.workshop-route-scope_&]:bg-card [.finance-route-scope_&]:border-white/10 [.finance-route-scope_&]:bg-card [.ai-reports-route-scope_&]:border-white/10 [.ai-reports-route-scope_&]:bg-card [.workflows-route-scope_&]:border-white/10 [.workflows-route-scope_&]:bg-card [.admin-route-scope_&]:border-white/10 [.admin-route-scope_&]:bg-card';

export const opTableWrapClass =
  'overflow-hidden rounded-xl border border-border bg-card shadow-sm shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.04)] dark:shadow-[inset_0_1px_0_0_hsl(var(--primary)/0.06)] [.operations-route-scope_&]:border-white/10 [.operations-route-scope_&]:bg-card [.inventory-route-scope_&]:border-white/10 [.inventory-route-scope_&]:bg-card [.crm-route-scope_&]:border-white/10 [.crm-route-scope_&]:bg-card [.workshop-route-scope_&]:border-white/10 [.workshop-route-scope_&]:bg-card [.finance-route-scope_&]:border-white/10 [.finance-route-scope_&]:bg-card [.ai-reports-route-scope_&]:border-white/10 [.ai-reports-route-scope_&]:bg-card [.workflows-route-scope_&]:border-white/10 [.workflows-route-scope_&]:bg-card [.admin-route-scope_&]:border-white/10 [.admin-route-scope_&]:bg-card';

export const opInsetClass =
  'rounded-xl border border-border bg-muted/40 [.operations-route-scope_&]:border-white/10 [.operations-route-scope_&]:bg-muted/50 [.inventory-route-scope_&]:border-white/10 [.inventory-route-scope_&]:bg-muted/50 [.crm-route-scope_&]:border-white/10 [.crm-route-scope_&]:bg-muted/50 [.workshop-route-scope_&]:border-white/10 [.workshop-route-scope_&]:bg-muted/50 [.finance-route-scope_&]:border-white/10 [.finance-route-scope_&]:bg-muted/50 [.ai-reports-route-scope_&]:border-white/10 [.ai-reports-route-scope_&]:bg-muted/50 [.workflows-route-scope_&]:border-white/10 [.workflows-route-scope_&]:bg-muted/50 [.admin-route-scope_&]:border-white/10 [.admin-route-scope_&]:bg-muted/50';

export const opTabsListClass =
  'inline-flex h-11 items-center justify-center gap-1 rounded-xl border border-border/50 bg-muted/40 p-1 text-muted-foreground dark:bg-muted/25';

export const opTabsTriggerClass =
  'rounded-lg px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm';

/** AUD currency for tables and summaries */
export function formatAud(amount: string | number | null | undefined): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
  if (!Number.isFinite(n)) {
    return '—';
  }
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n);
}

export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

// --- Status “tones”: border + soft bg + explicit text for contrast in dark mode ---

export function fulfilmentStatusTone(status: string): string {
  switch (status) {
    case 'pending':
      return 'border-border bg-muted/80 text-foreground';
    case 'picking':
      return 'border-sky-500/35 bg-sky-500/15 text-sky-950 dark:text-sky-100';
    case 'packing':
      return 'border-amber-500/35 bg-amber-500/15 text-amber-950 dark:text-amber-100';
    case 'shipped':
      return 'border-violet-500/35 bg-violet-500/15 text-violet-950 dark:text-violet-100';
    case 'delivered':
      return 'border-emerald-500/35 bg-emerald-500/15 text-emerald-950 dark:text-emerald-100';
    case 'cancelled':
      return 'border-destructive/40 bg-destructive/10 text-destructive';
    default:
      return 'border-border bg-muted/60 text-foreground';
  }
}

export function invoiceStatusTone(status: string): string {
  switch (status) {
    case 'draft':
      return 'border-border bg-muted/80 text-foreground';
    case 'sent':
      return 'border-sky-500/35 bg-sky-500/15 text-sky-950 dark:text-sky-100';
    case 'paid':
      return 'border-emerald-500/35 bg-emerald-500/15 text-emerald-950 dark:text-emerald-100';
    case 'overdue':
      return 'border-destructive/40 bg-destructive/15 text-destructive';
    case 'cancelled':
      return 'border-muted-foreground/30 bg-muted text-muted-foreground';
    default:
      return 'border-border bg-muted/60 text-foreground';
  }
}

export function paymentStatusTone(status: string): string {
  switch (status) {
    case 'completed':
      return 'border-emerald-500/35 bg-emerald-500/15 text-emerald-950 dark:text-emerald-100';
    case 'pending':
      return 'border-border bg-muted/80 text-foreground';
    case 'failed':
    case 'refunded':
      return 'border-destructive/40 bg-destructive/10 text-destructive';
    default:
      return 'border-border bg-muted/60 text-foreground';
  }
}

export function goodsReceiptStatusTone(status: string): string {
  switch (status) {
    case 'draft':
      return 'border-border bg-muted/80 text-foreground';
    case 'confirmed':
      return 'border-emerald-500/35 bg-emerald-500/15 text-emerald-950 dark:text-emerald-100';
    case 'synced':
      return 'border-sky-500/35 bg-sky-500/15 text-sky-950 dark:text-sky-100';
    case 'failed':
      return 'border-destructive/40 bg-destructive/10 text-destructive';
    default:
      return 'border-border bg-muted/60 text-foreground';
  }
}

export function lineConditionTone(condition: string): string {
  switch (condition) {
    case 'good':
      return 'border-emerald-500/35 bg-emerald-500/15 text-emerald-950 dark:text-emerald-100';
    case 'damaged':
      return 'border-destructive/40 bg-destructive/10 text-destructive';
    case 'short':
      return 'border-amber-500/35 bg-amber-500/15 text-amber-950 dark:text-amber-100';
    default:
      return 'border-border bg-muted/60 text-foreground';
  }
}

export function reconciliationAlertTone(
  severity: 'info' | 'warning' | 'critical'
): { card: string; iconWrap: string } {
  switch (severity) {
    case 'info':
      return {
        card: 'border-sky-500/30 bg-sky-500/[0.08] dark:bg-sky-500/10',
        iconWrap: 'text-sky-600 dark:text-sky-400',
      };
    case 'warning':
      return {
        card: 'border-amber-500/35 bg-amber-500/[0.08] dark:bg-amber-500/10',
        iconWrap: 'text-amber-600 dark:text-amber-400',
      };
    case 'critical':
      return {
        card: 'border-destructive/40 bg-destructive/10',
        iconWrap: 'text-destructive',
      };
  }
}
