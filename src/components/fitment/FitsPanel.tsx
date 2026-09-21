'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fitmentApi, type Fitment } from '@/lib/api/fitment';
import { Puzzle } from 'lucide-react';

type Props = { equipmentId: string } | { productId: string };

type State =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; linked: boolean; fits: Fitment[]; machines: Fitment[] };

function usage(f: Fitment) {
  if (f.usage_quantity == null) return null;
  return `${f.usage_quantity}${f.usage_per ? ` per ${f.usage_per}` : ''}`;
}

function FitRow({ f, show }: { f: Fitment; show: 'product' | 'machine' }) {
  const p = show === 'product' ? f.product : f.machine;
  return (
    <div className="flex items-center gap-3 border-b py-2 text-sm last:border-0">
      <Link href={`/dashboard/inventory/products/${p.id}`} className="font-medium hover:underline">
        {p.name}
      </Link>
      <span className="text-muted-foreground font-mono text-xs">{p.sku}</span>
      <span className="text-muted-foreground capitalize">{f.kind}</span>
      {usage(f) && <span className="text-muted-foreground">{usage(f)}</span>}
      <Badge className="ml-auto" variant={f.status === 'confirmed' ? 'default' : 'outline'}>
        {f.status === 'confirmed' ? 'Confirmed' : 'Suggested, not confirmed'}
      </Badge>
    </div>
  );
}

/**
 * UNI-2748 "Fits this machine" panel for the equipment and product pages.
 * Staff view: suggested rows are shown, labelled as unconfirmed.
 */
export function FitsPanel(props: Props) {
  const [state, setState] = useState<State>({ phase: 'loading' });
  const equipmentId = 'equipmentId' in props ? props.equipmentId : null;
  const productId = 'productId' in props ? props.productId : null;

  const load = useCallback(async () => {
    try {
      if (equipmentId) {
        const res = await fitmentApi.forEquipment(equipmentId);
        setState({ phase: 'ready', linked: res.linked, fits: res.items, machines: [] });
      } else if (productId) {
        const [fits, machines] = await Promise.all([
          fitmentApi.forMachine(productId),
          fitmentApi.forProduct(productId),
        ]);
        setState({ phase: 'ready', linked: true, fits: fits.items, machines: machines.items });
      }
    } catch (e) {
      setState({ phase: 'error', message: e instanceof Error ? e.message : 'Could not load' });
    }
  }, [equipmentId, productId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Puzzle className="h-4 w-4" /> Fits this machine
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {state.phase === 'loading' && <p className="text-muted-foreground text-sm">Loading...</p>}
        {state.phase === 'error' && (
          <p className="text-sm text-red-600">
            Could not load the parts map: {state.message}. This is a failed read, not an empty map.
          </p>
        )}
        {state.phase === 'ready' && !state.linked && (
          <p className="text-muted-foreground text-sm">
            This machine is not linked to a product, so the parts map cannot be looked up. Link it
            to its machine product to see what fits.
          </p>
        )}
        {state.phase === 'ready' && state.linked && (
          <>
            {state.fits.length > 0 ? (
              <div>
                {state.fits.map((f) => (
                  <FitRow key={f.id} f={f} show="product" />
                ))}
              </div>
            ) : (
              productId === null && (
                <p className="text-muted-foreground text-sm">
                  No products mapped to this machine yet.{' '}
                  <Link href="/dashboard/workshop/fitment" className="underline">
                    Open the parts map
                  </Link>
                  .
                </p>
              )
            )}
            {state.machines.length > 0 && (
              <div>
                <div className="mb-1 text-sm font-medium">Used on these machines</div>
                {state.machines.map((f) => (
                  <FitRow key={f.id} f={f} show="machine" />
                ))}
              </div>
            )}
            {productId !== null && state.fits.length === 0 && state.machines.length === 0 && (
              <p className="text-muted-foreground text-sm">
                Not in the parts map yet.{' '}
                <Link href="/dashboard/workshop/fitment" className="underline">
                  Open the parts map
                </Link>
                .
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
