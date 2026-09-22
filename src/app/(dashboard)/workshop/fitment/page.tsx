'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';
import { fitmentApi, type Fitment } from '@/lib/api/fitment';

const FILTERS = [
  { id: 'suggested', label: 'To confirm' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'rejected', label: 'Rejected' },
  { id: '', label: 'All' },
];

const SOURCE_LABEL: Record<Fitment['source'], string> = {
  manual: 'Entered by staff',
  import: 'Spreadsheet',
  bom: 'Cin7 BOM',
  order_history: 'Past orders',
};

const PAGE_SIZE = 50;

export default function FitmentMapPage() {
  const { toast } = useToast();
  const [status, setStatus] = useState('suggested');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Fitment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmImport, setConfirmImport] = useState(false);
  const [importErrors, setImportErrors] = useState<{ line: number; message: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fitmentApi.list({ status, search, page, page_size: PAGE_SIZE });
      setItems(data.items);
      setTotal(data.total);
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [status, search, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function run<T>(label: string, fn: () => Promise<T>, done: (r: T) => string) {
    setBusy(true);
    try {
      const r = await fn();
      toast({ title: done(r) });
      await load();
    } catch (error: unknown) {
      toast({
        title: `${label} failed`,
        description: error instanceof Error ? error.message : 'Failed',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    const csv = await file.text();
    await run(
      'Import',
      async () => {
        const r = await fitmentApi.importCsv(csv, confirmImport);
        setImportErrors(r.errors);
        return r;
      },
      (r) =>
        `Imported ${r.imported} row(s)${r.errors.length ? `, ${r.errors.length} need fixing` : ''}`
    );
  }

  const pages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <ErrorBoundary>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold">Parts map</h1>
          <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
            Which consumables, parts and accessories fit each machine. Drafted rows stay
            &ldquo;suggested&rdquo; until someone who knows the product confirms them. Customers
            only ever see confirmed rows.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={busy}
            onClick={() =>
              run(
                'Drafting',
                fitmentApi.suggest,
                (r) =>
                  `Drafted ${r.from_bom} from BOMs and ${r.from_orders} from past orders (${r.skipped_existing} already in the map)`
              )
            }
          >
            Draft suggestions from BOMs and orders
          </Button>
          <label className="border-input cursor-pointer rounded-md border px-3 py-2 text-sm">
            Import spreadsheet (CSV)
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                onFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirmImport}
              onChange={(e) => setConfirmImport(e.target.checked)}
            />
            Mark imported rows as confirmed
          </label>
          <span className="text-muted-foreground text-xs">
            Columns: machine_sku, fit_sku, kind (consumable, part or accessory), usage_quantity,
            usage_per
          </span>
        </div>

        {importErrors.length > 0 && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:bg-amber-950">
            <div className="mb-1 font-medium">Rows not imported</div>
            <ul className="list-inside list-disc">
              {importErrors.map((e) => (
                <li key={`${e.line}-${e.message}`}>
                  Line {e.line}: {e.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <Button
              key={f.id || 'all'}
              size="sm"
              variant={status === f.id ? 'default' : 'outline'}
              onClick={() => {
                setStatus(f.id);
                setPage(1);
              }}
            >
              {f.label}
            </Button>
          ))}
          <Input
            className="ml-auto h-8 w-64"
            placeholder="Search machine or product"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {loading ? (
          <div className="bg-muted h-24 animate-pulse rounded-lg" />
        ) : loadError ? (
          <p className="text-sm text-red-600">
            Could not load the parts map: {loadError}. This is a failed read, not an empty map.
          </p>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground text-sm">No rows match this view.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left">Machine</th>
                  <th className="px-3 py-2 text-left">Fits</th>
                  <th className="px-3 py-2 text-left">Kind</th>
                  <th className="px-3 py-2 text-left">Why</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((f) => (
                  <tr key={f.id}>
                    <td className="px-3 py-2">
                      <div className="font-medium">{f.machine.name}</div>
                      <div className="font-mono text-xs">{f.machine.sku}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{f.product.name}</div>
                      <div className="font-mono text-xs">{f.product.sku}</div>
                    </td>
                    <td className="px-3 py-2 capitalize">{f.kind}</td>
                    <td className="text-muted-foreground px-3 py-2 text-xs">
                      <div>{SOURCE_LABEL[f.source]}</div>
                      {f.evidence && <div>{f.evidence}</div>}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={f.status === 'confirmed' ? 'default' : 'outline'}>
                        {f.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        {f.status !== 'confirmed' && (
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              run(
                                'Confirm',
                                () => fitmentApi.review(f.id, { status: 'confirmed' }),
                                () => 'Confirmed'
                              )
                            }
                          >
                            Confirm
                          </Button>
                        )}
                        {f.status !== 'rejected' && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              run(
                                'Reject',
                                () => fitmentApi.review(f.id, { status: 'rejected' }),
                                () => 'Rejected'
                              )
                            }
                          >
                            Does not fit
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center gap-2 text-sm">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <span>
              Page {page} of {pages} ({total} rows)
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= pages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
