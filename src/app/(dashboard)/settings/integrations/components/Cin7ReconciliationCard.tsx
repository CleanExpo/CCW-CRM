'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  getCin7ExceptionReport,
  getCin7ExceptionReportExportUrl,
  getCin7Reconciliation,
  type Cin7ExceptionEntity,
  type Cin7ExceptionRecord,
  type Cin7ReconciliationResponse,
} from '@/lib/api/cin7';
import { AlertTriangle, BarChart3, FileWarning, Loader2, RefreshCw } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

type Cin7ReconciliationCardProps = {
  isConnected: boolean;
};

const EXCEPTION_ENTITIES: { key: Cin7ExceptionEntity; label: string }[] = [
  { key: 'products', label: 'Products' },
  { key: 'customers', label: 'Customers' },
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'branches', label: 'Branches' },
  { key: 'internal-customers', label: 'Internal' },
  { key: 'product-categories', label: 'Categories' },
  { key: 'brands', label: 'Brands' },
  { key: 'price-lists', label: 'Price lists' },
  { key: 'tax-codes', label: 'Tax codes' },
  { key: 'units-of-measure', label: 'UOM' },
  { key: 'stock-levels', label: 'Stock' },
  { key: 'warehouses', label: 'Warehouses' },
];

function CountRow({
  label,
  cin7,
  optix,
  mismatch,
}: {
  label: string;
  cin7: number | string;
  optix: number | string;
  mismatch?: boolean;
}) {
  return (
    <div className="border-border/50 flex items-center justify-between border-b py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`font-medium tabular-nums ${mismatch ? 'text-amber-600 dark:text-amber-400' : ''}`}
      >
        Cin7 {cin7} · Optix {optix}
      </span>
    </div>
  );
}

function reasonLabel(reason: Cin7ExceptionRecord['reason']): string {
  switch (reason) {
    case 'missing_in_optix':
      return 'In Cin7, not in Optix';
    case 'extra_in_optix':
      return 'In Optix, not in Cin7';
    case 'field_mismatch':
      return 'Field mismatch';
    case 'skipped_on_sync':
      return 'Skipped on sync';
    default:
      return reason;
  }
}

function formatCacheAge(cachedAt: string | null | undefined): string {
  if (!cachedAt) return 'just now';
  const ageMs = Date.now() - new Date(cachedAt).getTime();
  if (ageMs < 60_000) return 'less than a minute ago';
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hour${hours === 1 ? '' : 's'} ago`;
}

export function Cin7ReconciliationCard({ isConnected }: Cin7ReconciliationCardProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [liveLoading, setLiveLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<Cin7ReconciliationResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exceptionEntity, setExceptionEntity] = useState<Cin7ExceptionEntity>('products');
  const [exceptions, setExceptions] = useState<Cin7ExceptionRecord[]>([]);
  const [exceptionsLoading, setExceptionsLoading] = useState(false);
  const [exceptionTotal, setExceptionTotal] = useState(0);
  const [exceptionOffset, setExceptionOffset] = useState(0);
  const loadRequestId = useRef(0);
  const EXCEPTION_PAGE = 100;

  const load = useCallback(
    async (options?: { force?: boolean; silent?: boolean }) => {
      const requestId = ++loadRequestId.current;
      const force = options?.force ?? false;
      if (force) setLiveLoading(true);
      else setLoading(true);
      setLoadError(null);

      try {
        const data = await getCin7Reconciliation({ force });
        if (requestId !== loadRequestId.current) return;
        setSnapshot(data);
        if (!options?.silent) {
          toast({
            title: force ? 'Live Cin7 reconciliation complete' : 'Reconciliation refreshed',
            description: data.cache_meta?.from_cache
              ? `Showing cached counts from ${formatCacheAge(data.cache_meta.cached_at)}. Use live refresh for a fresh Cin7 pull.`
              : 'Counts updated from Cin7 and Optix.',
          });
        }
      } catch (error: unknown) {
        if (requestId !== loadRequestId.current) return;
        const message = error instanceof Error ? error.message : 'Could not load counts';
        setLoadError(message);
        toast({
          variant: 'destructive',
          title: 'Reconciliation failed',
          description: snapshot ? `${message} Showing your last successful counts below.` : message,
        });
      } finally {
        if (requestId === loadRequestId.current) {
          setLoading(false);
          setLiveLoading(false);
        }
      }
    },
    [snapshot, toast]
  );

  // Manual refresh only — auto-loading on connect fights sync for Cin7 rate limits
  // and looks like "reloading from scratch" every time status flips.
  const loadExceptions = async (entity: Cin7ExceptionEntity, offset = 0, append = false) => {
    setExceptionsLoading(true);
    setExceptionEntity(entity);
    try {
      const data = await getCin7ExceptionReport(entity, EXCEPTION_PAGE, offset);
      setExceptions((prev) => (append ? [...prev, ...data.items] : data.items));
      setExceptionTotal(data.total);
      setExceptionOffset(offset + data.items.length);
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Exception report failed',
        description: error instanceof Error ? error.message : 'Could not load exceptions',
      });
      if (!append) {
        setExceptions([]);
        setExceptionTotal(0);
        setExceptionOffset(0);
      }
    } finally {
      setExceptionsLoading(false);
    }
  };

  const ex = snapshot?.exceptions_summary;
  const isRefreshing = loading || liveLoading;
  const fromCache = snapshot?.cache_meta?.from_cache;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4" />
          Master data reconciliation
        </CardTitle>
        <CardDescription>
          Cin7 is the source of truth. Compare live counts, then review the exception report for
          individual records. No data is deleted during this phase.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!isConnected || isRefreshing}
            onClick={() => void load()}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh counts
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!isConnected || isRefreshing}
            onClick={() => void load({ force: true })}
          >
            {liveLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh from live Cin7
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!isConnected || !snapshot || exceptionsLoading}
            onClick={() => void loadExceptions(exceptionEntity, 0, false)}
          >
            {exceptionsLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileWarning className="mr-2 h-4 w-4" />
            )}
            Load exception report
          </Button>
        </div>

        {loadError ? (
          <p className="flex items-start gap-1.5 text-sm text-amber-600 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {loadError}
            {snapshot ? ' Your last successful reconciliation is shown below.' : null}
          </p>
        ) : null}

        {snapshot?.source === 'none' ? (
          <div className="border-destructive/40 bg-destructive/5 rounded-lg border p-3">
            <p className="text-destructive flex items-start gap-1.5 text-sm font-medium">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Cin7 is unreachable — counts below are not valid for acceptance. Reconnect and refresh
              from live Cin7.
            </p>
          </div>
        ) : null}

        {snapshot && snapshot.fetch_meta.errors.length > 0 ? (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
            <p className="flex items-start gap-1.5 text-sm font-medium text-amber-600 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Cin7 fetch was incomplete — do not use this snapshot for sign-off until a clean live
              refresh succeeds.
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {snapshot.fetch_meta.errors.slice(0, 3).join('; ')}
            </p>
          </div>
        ) : null}

        {snapshot ? (
          <div className="space-y-4">
            <div
              className={`bg-muted/30 space-y-3 rounded-lg border p-4 ${isRefreshing ? 'opacity-70' : ''}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">Source: {snapshot.source}</Badge>
                  {fromCache ? (
                    <Badge variant="secondary" className="text-xs">
                      Cached · {formatCacheAge(snapshot.cache_meta?.cached_at)}
                    </Badge>
                  ) : null}
                  {isRefreshing ? (
                    <Badge variant="outline" className="text-xs">
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      Updating…
                    </Badge>
                  ) : null}
                </div>
                <span className="text-muted-foreground text-xs">
                  Checked {new Date(snapshot.checked_at).toLocaleString()}
                </span>
              </div>
              <CountRow
                label="Product SKUs (all visibility)"
                cin7={snapshot.cin7.products.skus}
                optix={snapshot.optix.products.skus}
                mismatch={snapshot.cin7.products.skus !== snapshot.optix.products.skus}
              />
              <CountRow
                label="Product styles"
                cin7={snapshot.cin7.products.styles}
                optix={snapshot.optix.products.styles}
                mismatch={snapshot.cin7.products.styles !== snapshot.optix.products.styles}
              />
              <CountRow
                label="CRM customers"
                cin7={snapshot.cin7.customers}
                optix={snapshot.optix.customers.cin7_linked}
                mismatch={snapshot.cin7.customers !== snapshot.optix.customers.cin7_linked}
              />
              <CountRow
                label="Internal customers"
                cin7={snapshot.cin7.internal_customers}
                optix={snapshot.optix.internal_customers}
              />
              <CountRow
                label="Suppliers"
                cin7={snapshot.cin7.suppliers}
                optix={snapshot.optix.suppliers.cin7_linked}
                mismatch={snapshot.cin7.suppliers !== snapshot.optix.suppliers.cin7_linked}
              />
              <CountRow
                label="Branches"
                cin7={snapshot.cin7.branches}
                optix={snapshot.optix.branches.total}
                mismatch={snapshot.cin7.branches !== snapshot.optix.branches.total}
              />

              {snapshot.cin7.reference && snapshot.optix.reference ? (
                <>
                  <CountRow
                    label="Product categories"
                    cin7={snapshot.cin7.reference.product_categories}
                    optix={snapshot.optix.reference.product_categories}
                    mismatch={
                      snapshot.cin7.reference.product_categories !==
                      snapshot.optix.reference.product_categories
                    }
                  />
                  <CountRow
                    label="Brands"
                    cin7={snapshot.cin7.reference.brands}
                    optix={snapshot.optix.reference.brands}
                    mismatch={snapshot.cin7.reference.brands !== snapshot.optix.reference.brands}
                  />
                  <CountRow
                    label="Price lists"
                    cin7={snapshot.cin7.reference.price_lists}
                    optix={snapshot.optix.reference.price_lists}
                    mismatch={
                      snapshot.cin7.reference.price_lists !== snapshot.optix.reference.price_lists
                    }
                  />
                  <CountRow
                    label="Tax codes"
                    cin7={snapshot.cin7.reference.tax_codes}
                    optix={snapshot.optix.reference.tax_codes}
                    mismatch={
                      snapshot.cin7.reference.tax_codes !== snapshot.optix.reference.tax_codes
                    }
                  />
                  <CountRow
                    label="Units of measure"
                    cin7={snapshot.cin7.reference.units_of_measure}
                    optix={snapshot.optix.reference.units_of_measure}
                    mismatch={
                      snapshot.cin7.reference.units_of_measure !==
                      snapshot.optix.reference.units_of_measure
                    }
                  />
                  <CountRow
                    label="Stock levels (branch × SKU)"
                    cin7={snapshot.cin7.reference.stock_levels}
                    optix={snapshot.optix.reference.stock_levels}
                    mismatch={
                      snapshot.cin7.reference.stock_levels !== snapshot.optix.reference.stock_levels
                    }
                  />
                  <CountRow
                    label="Warehouses (Cin7 branches)"
                    cin7={snapshot.cin7.reference.warehouses}
                    optix={snapshot.optix.reference.warehouses}
                    mismatch={
                      snapshot.cin7.reference.warehouses !== snapshot.optix.reference.warehouses
                    }
                  />
                </>
              ) : null}

              {ex ? (
                <div className="border-border/50 mt-2 space-y-1 border-t pt-2 text-xs">
                  <p className="text-muted-foreground font-medium">Exception summary</p>
                  <p>
                    Products: {ex.products_missing_in_optix} missing · {ex.products_extra_in_optix}{' '}
                    extra · {ex.products_field_mismatches} field diffs
                  </p>
                  <p>
                    Customers: {ex.customers_missing_in_optix} missing ·{' '}
                    {ex.customers_extra_in_optix} extra · {ex.customers_field_mismatches} field
                    diffs
                  </p>
                  <p>
                    Suppliers: {ex.suppliers_missing_in_optix} missing ·{' '}
                    {ex.suppliers_extra_in_optix} extra · {ex.suppliers_field_mismatches} field
                    diffs
                  </p>
                  <p>
                    Branches: {ex.branches_missing_in_optix} missing · {ex.branches_extra_in_optix}{' '}
                    extra · {ex.branches_field_mismatches} field diffs
                  </p>
                  <p>
                    Internal: {ex.internal_customers_missing_in_optix} missing ·{' '}
                    {ex.internal_customers_extra_in_optix} extra ·{' '}
                    {ex.internal_customers_field_mismatches} field diffs
                  </p>
                  <p>
                    Categories: {ex.product_categories_missing_in_optix} missing ·{' '}
                    {ex.product_categories_extra_in_optix} extra
                  </p>
                  <p>
                    Brands: {ex.brands_missing_in_optix} missing · {ex.brands_extra_in_optix} extra
                  </p>
                  <p>
                    Price lists: {ex.price_lists_missing_in_optix} missing ·{' '}
                    {ex.price_lists_extra_in_optix} extra
                  </p>
                  <p>
                    Tax codes: {ex.tax_codes_missing_in_optix} missing ·{' '}
                    {ex.tax_codes_extra_in_optix} extra
                  </p>
                  <p>
                    UOM: {ex.units_of_measure_missing_in_optix} missing ·{' '}
                    {ex.units_of_measure_extra_in_optix} extra
                  </p>
                  <p>
                    Stock: {ex.stock_levels_missing_in_optix} missing ·{' '}
                    {ex.stock_levels_extra_in_optix} extra · {ex.stock_levels_field_mismatches}{' '}
                    field diffs
                  </p>
                </div>
              ) : null}

              {snapshot.optix.customers.extra_without_cin7_id > 0 ? (
                <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {snapshot.optix.customers.extra_without_cin7_id} Optix customers have no Cin7 id —
                  these are legacy CRM records. Sync adds Cin7-linked rows; it does not merge or
                  backfill IDs onto existing Optix-only customers (Phase 1: no merge/delete/cleanse).
                </p>
              ) : null}

              {snapshot.notes.map((note) => (
                <p key={note} className="text-muted-foreground text-xs">
                  {note}
                </p>
              ))}
            </div>

            <Tabs
              value={exceptionEntity}
              onValueChange={(v) => {
                setExceptionEntity(v as Cin7ExceptionEntity);
                setExceptions([]);
                setExceptionTotal(0);
                setExceptionOffset(0);
              }}
            >
              <TabsList className="flex h-auto max-h-32 flex-wrap gap-1 overflow-y-auto">
                {EXCEPTION_ENTITIES.map(({ key, label }) => (
                  <TabsTrigger key={key} value={key} className="text-xs">
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {EXCEPTION_ENTITIES.map(({ key }) => (
                <TabsContent key={key} value={key} className="mt-3">
                  {exceptionsLoading && exceptionEntity === key ? (
                    <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Building exception report from live Cin7…
                    </div>
                  ) : exceptions.length === 0 || exceptionEntity !== key ? (
                    <p className="text-muted-foreground py-4 text-sm">
                      Click &quot;Load exception report&quot; to list records that differ between
                      Cin7 and Optix for {key.replace(/-/g, ' ')}.
                    </p>
                  ) : (
                    <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg border p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-muted-foreground text-xs">
                          Showing {exceptions.length} of {exceptionTotal} exception(s)
                        </p>
                        <div className="flex gap-2">
                          {exceptions.length < exceptionTotal ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              disabled={exceptionsLoading}
                              onClick={() =>
                                void loadExceptions(exceptionEntity, exceptionOffset, true)
                              }
                            >
                              Load more
                            </Button>
                          ) : null}
                          <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                            <a href={getCin7ExceptionReportExportUrl(exceptionEntity)} download>
                              Export CSV
                            </a>
                          </Button>
                        </div>
                      </div>
                      {exceptions.map((row, idx) => (
                        <div
                          key={`${row.cin7_id}-${row.reason}-${idx}`}
                          className="border-border/60 bg-background/50 rounded-md border px-3 py-2 text-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium">{row.label}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {reasonLabel(row.reason)}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground mt-0.5 font-mono">{row.cin7_id}</p>
                          {row.skipped_reason ? (
                            <p className="text-muted-foreground mt-1">
                              Reason: {row.skipped_reason}
                            </p>
                          ) : null}
                          {Array.isArray(row.fields)
                            ? row.fields.map((f) => (
                                <p key={f.field} className="text-muted-foreground mt-1">
                                  <span className="text-foreground">{f.field}:</span> Cin7 &quot;
                                  {f.cin7_value}&quot; · Optix &quot;{f.optix_value}&quot;
                                </p>
                              ))
                            : null}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </div>
        ) : isRefreshing ? (
          <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading reconciliation from Cin7… this can take a few minutes on first run.
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            {isConnected
              ? 'Click refresh to compare full Cin7 catalog counts with Optix.'
              : 'Connect Cin7 to run reconciliation.'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
