import { BarChart3, Package, Truck, Users } from 'lucide-react';

/**
 * Decorative “product window” for the marketing hero — not live data.
 */
export function ErpDashboardMockup() {
  return (
    <div className="relative mx-auto w-full max-w-lg">
      <div
        className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-primary/20 via-accent/10 to-transparent blur-2xl"
        aria-hidden
      />
      <div className="border-border/80 bg-card relative overflow-hidden rounded-2xl border shadow-2xl ring-1 ring-black/5">
        <div className="bg-muted/50 flex items-center gap-2 border-b px-4 py-3">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/90" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/90" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
          </div>
          <div className="bg-background/80 text-muted-foreground ml-2 flex-1 rounded-md border px-3 py-1 text-xs font-medium">
            app.ccwonline.com.au / dashboard
          </div>
        </div>
        <div className="grid gap-4 p-4 md:grid-cols-[1fr_1.1fr] md:p-5">
          <div className="space-y-3">
            <div className="bg-primary/5 flex items-center gap-2 rounded-xl border border-primary/15 px-3 py-2">
              <BarChart3 className="text-primary h-4 w-4" />
              <div>
                <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
                  Pipeline
                </p>
                <p className="text-sm font-semibold">Quote → order health</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border bg-gradient-to-br from-card to-muted/40 p-3">
                <Users className="text-primary mb-2 h-4 w-4" />
                <p className="text-muted-foreground text-[10px] uppercase">Customers</p>
                <p className="text-lg font-bold tracking-tight">Active</p>
              </div>
              <div className="rounded-xl border bg-gradient-to-br from-card to-muted/40 p-3">
                <Package className="text-accent mb-2 h-4 w-4" />
                <p className="text-muted-foreground text-[10px] uppercase">Stock</p>
                <p className="text-lg font-bold tracking-tight">By location</p>
              </div>
            </div>
            <div className="bg-muted/40 flex items-center gap-2 rounded-xl border px-3 py-2.5">
              <Truck className="text-muted-foreground h-4 w-4" />
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground truncate text-xs">Fulfilment &amp; transfers</p>
                <div className="bg-primary/80 mt-1.5 h-1.5 w-3/4 rounded-full" />
              </div>
            </div>
          </div>
          <div className="bg-muted/30 flex flex-col rounded-xl border p-3">
            <p className="text-muted-foreground mb-2 text-[10px] font-semibold uppercase tracking-wider">
              Today
            </p>
            <div className="space-y-2">
              {[72, 48, 88, 56].map((w, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div
                    className="bg-primary w-1 shrink-0 rounded-full opacity-40"
                    style={{ height: `${16 + i * 6}px` }}
                  />
                  <div className="bg-foreground/10 h-2 rounded-full" style={{ width: `${w}%` }} />
                </div>
              ))}
            </div>
            <div className="border-border/60 mt-auto grid grid-cols-3 gap-2 border-t pt-3">
              {['Quotes', 'Orders', 'Alerts'].map((label) => (
                <div key={label} className="text-center">
                  <div className="bg-primary/15 mx-auto mb-1 h-6 w-10 rounded-md" />
                  <span className="text-muted-foreground text-[10px] font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
