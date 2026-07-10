'use client';

import { useState } from 'react';
import { AlertTriangle, BarChart3, FileWarning, Loader2, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  getCin7ExceptionReport,
  getCin7ExceptionReportExportUrl,
  getCin7Reconciliation,
  type Cin7ExceptionEntity,
  type Cin7ExceptionRecord,
  type Cin7ReconciliationSnapshot,
} from '@/lib/api/cin7';

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
    <div className="flex items-center justify-between border-b border-border/50 py-2 text-sm last:border-0">
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

export function Cin7ReconciliationCard({ isConnected }: Cin7ReconciliationCardProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<Cin7ReconciliationSnapshot | null>(null);
  const [exceptionEntity, setExceptionEntity] = useState<Cin7ExceptionEntity>('products');
  const [exceptions, setExceptions] = useState<Cin7ExceptionRecord[]>([]);
  const [exceptionsLoading, setExceptionsLoading] = useState(false);
  const [exceptionTotal, setExceptionTotal] = useState(0);
  const [exceptionOffset, setExceptionOffset] = useState(0);
  const EXCEPTION_PAGE = 100;

  const load = async () => {
    setLoading(true);
    try {
      const data = await getCin7Reconciliation();
      setSnapshot(data);
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Reconciliation failed',
        description: error instanceof Error ? error.message : 'Could not load counts',
      });
    } finally {
      setLoading(false);
    }
  };

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
      setExceptions([]);
      setExceptionTotal(0);
      setExceptionOffset(0);
    } finally {
      setExceptionsLoading(false);
    }
  };

  const ex = snapshot?.exceptions_summary;

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
            disabled={!isConnected || loading}
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

        {snapshot ? (
          <div className="space-y-4">
            <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <Badge variant="outline">Source: {snapshot.source}</Badge>
                <span className="text-muted-foreground text-xs">
                  {new Date(snapshot.checked_at).toLocaleString()}
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
                    {ex.customers_extra_in_optix} extra · {ex.customers_field_mismatches} field diffs
                  </p>
                  <p>
                    Suppliers: {ex.suppliers_missing_in_optix} missing · {ex.suppliers_extra_in_optix}{' '}
                    extra · {ex.suppliers_field_mismatches} field diffs
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
                <p className="flex items-start gap-1.5 text-amber-600 text-xs dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {snapshot.optix.customers.extra_without_cin7_id} Optix customers have no Cin7 id
                  — run a full customer sync to link them (records are not deleted).
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
              onValueChange={(v) => void loadExceptions(v as Cin7ExceptionEntity, 0, false)}
            >
              <TabsList className="flex h-auto flex-wrap gap-1">
                {EXCEPTION_ENTITIES.map(({ key, label }) => (
                  <TabsTrigger key={key} value={key} className="text-xs">
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {EXCEPTION_ENTITIES.map(({ key }) => (
                <TabsContent key={key} value={key} className="mt-3">
                  {exceptionsLoading ? (
                    <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Building exception report from live Cin7…
                    </div>
                  ) : exceptions.length === 0 ? (
                    <p className="text-muted-foreground py-4 text-sm">
                      Click &quot;Load exception report&quot; to list records that differ between
                      Cin7 and Optix.
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
                          className="rounded-md border border-border/60 bg-background/50 px-3 py-2 text-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium">{row.label}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {reasonLabel(row.reason)}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground mt-0.5 font-mono">{row.cin7_id}</p>
                          {row.skipped_reason ? (
                            <p className="text-muted-foreground mt-1">Reason: {row.skipped_reason}</p>
                          ) : null}
                          {row.fields?.map((f) => (
                            <p key={f.field} className="text-muted-foreground mt-1">
                              <span className="text-foreground">{f.field}:</span> Cin7 &quot;
                              {f.cin7_value}&quot; · Optix &quot;{f.optix_value}&quot;
                            </p>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
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
