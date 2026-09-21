'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';
import { PriceTag } from '@/components/price-mole/PriceTag';
import { priceMoleApi, type CaptureResult, type CompetitorRow } from '@/lib/api/price-mole';

/** UNI-2751: staff screen to match competitor pages to CCW products and check prices. */
export default function PriceMolePage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<CompetitorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    competitor: '',
    url: '',
    product_sku: '',
    competitor_sku: '',
  });
  const [manual, setManual] = useState<Record<string, string>>({});
  const [lastRun, setLastRun] = useState<CaptureResult['run'] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setRows((await priceMoleApi.list()).items);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act<T>(label: string, fn: () => Promise<T>, done?: (r: T) => string) {
    setBusy(true);
    try {
      const r = await fn();
      if (done) toast({ title: done(r) });
      await load();
    } catch (e) {
      toast({
        title: `${label} failed`,
        description: e instanceof Error ? e.message : 'Failed',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <ErrorBoundary>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold">Price Mole</h1>
          <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
            Competitor prices from their public product pages. Pages are only read when the
            site&rsquo;s robots.txt allows it, at most once a day, and each run stops at its page
            budget. Only confirmed matches show in the quote builder. Every price shows the date it
            was seen; prices over 7 days old are marked stale.
          </p>
        </div>

        <div className="grid gap-2 rounded-lg border p-4 md:grid-cols-5">
          <Input
            placeholder="Competitor"
            value={form.competitor}
            onChange={(e) => setForm({ ...form, competitor: e.target.value })}
          />
          <Input
            className="md:col-span-2"
            placeholder="Public product page URL"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
          />
          <Input
            placeholder="CCW SKU it matches"
            value={form.product_sku}
            onChange={(e) => setForm({ ...form, product_sku: e.target.value })}
          />
          <Button
            disabled={busy || !form.competitor || !form.url}
            onClick={() =>
              act(
                'Adding',
                () =>
                  priceMoleApi.create({
                    competitor: form.competitor,
                    url: form.url,
                    product_sku: form.product_sku || undefined,
                  }),
                () => {
                  setForm({ competitor: '', url: '', product_sku: '', competitor_sku: '' });
                  return 'Added. Confirm the match once checked.';
                }
              )
            }
          >
            Track page
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              act(
                'Price check',
                () => priceMoleApi.capture({}),
                (r) => {
                  setLastRun(r.run);
                  return `Checked ${r.run.attempted} page(s): ${r.run.succeeded} read, ${r.run.failed} failed, ${r.run.skipped} skipped`;
                }
              )
            }
          >
            Check prices now
          </Button>
          {lastRun?.stopped_reason && (
            <span className="text-sm text-amber-600">Stopped: {lastRun.stopped_reason}</span>
          )}
        </div>

        {loading ? (
          <div className="bg-muted h-24 animate-pulse rounded-lg" />
        ) : loadError ? (
          <p className="text-sm text-red-600">
            Could not load Price Mole: {loadError}. This is a failed read, not an empty list.
          </p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">No competitor pages tracked yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left">Competitor page</th>
                  <th className="px-3 py-2 text-left">CCW product</th>
                  <th className="px-3 py-2 text-left">Latest price</th>
                  <th className="px-3 py-2 text-left">Match</th>
                  <th className="px-3 py-2 text-left" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.competitor}</div>
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted-foreground text-xs break-all underline"
                      >
                        {r.title ?? r.url}
                      </a>
                      {r.last_error && (
                        <div className="mt-1 text-xs text-amber-600">
                          Last check failed: {r.last_error}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {r.product ? (
                        <>
                          <div>{r.product.name}</div>
                          <div className="text-muted-foreground text-xs">
                            {r.product.sku} · CCW ${r.product.price.toFixed(2)}
                          </div>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Not linked</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <PriceTag p={r.latest_price} />
                      {r.history.length > 1 && (
                        <div className="text-muted-foreground mt-1 text-xs">
                          Earlier:{' '}
                          {r.history
                            .slice(1, 4)
                            .map(
                              (h) =>
                                `$${h.price.toFixed(2)} (${new Date(h.captured_at).toLocaleDateString('en-AU')})`
                            )
                            .join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={r.match_status === 'confirmed' ? 'default' : 'outline'}>
                        {r.match_status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap justify-end gap-1">
                        {r.match_status !== 'confirmed' && r.product && (
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              act('Confirm', () => priceMoleApi.review(r.id, 'confirmed'))
                            }
                          >
                            Confirm match
                          </Button>
                        )}
                        {r.match_status !== 'rejected' && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              act('Reject', () => priceMoleApi.review(r.id, 'rejected'))
                            }
                          >
                            Not a match
                          </Button>
                        )}
                        <Input
                          className="h-8 w-24"
                          placeholder="Price seen"
                          value={manual[r.id] ?? ''}
                          onChange={(e) => setManual({ ...manual, [r.id]: e.target.value })}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy || !manual[r.id]}
                          onClick={() =>
                            act(
                              'Saving price',
                              () => priceMoleApi.manualPrice(r.id, Number(manual[r.id])),
                              () => {
                                setManual({ ...manual, [r.id]: '' });
                                return 'Price saved with today’s date';
                              }
                            )
                          }
                        >
                          Save
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
