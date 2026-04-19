'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api/client';

interface InventorySerial {
  id: string;
  product_id: string;
  serial_number: string;
  status: string;
  location: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface InventoryLot {
  id: string;
  product_id: string;
  lot_number: string;
  batch_number: string | null;
  quantity_received: number;
  quantity_remaining: number;
  expiry_date: string | null;
  received_date: string | null;
  location: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
}

const STATUS_COLOURS: Record<string, string> = {
  available: 'bg-green-100 text-green-800',
  reserved: 'bg-yellow-100 text-yellow-800',
  sold: 'bg-blue-100 text-blue-800',
  servicing: 'bg-purple-100 text-purple-800',
  retired: 'bg-gray-100 text-gray-800',
};

export default function InventorySkuPage() {
  const params = useParams<{ sku: string }>();
  const sku = decodeURIComponent(params.sku ?? '');

  const [product, setProduct] = useState<Product | null>(null);
  const [serials, setSerials] = useState<InventorySerial[]>([]);
  const [lots, setLots] = useState<InventoryLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sku) return;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        // Look up the product by SKU via the search parameter
        const productsResp = await apiClient.get<{ items: Product[] }>(
          `/api/products?search=${encodeURIComponent(sku)}&page_size=1`
        );
        const found = productsResp.items?.find(
          (p) => p.sku.toLowerCase() === sku.toLowerCase()
        );
        if (!found) {
          setError(`No product found with SKU "${sku}"`);
          return;
        }
        setProduct(found);

        // Fetch serials and lots in parallel
        const [serialsResp, lotsResp] = await Promise.all([
          apiClient.get<InventorySerial[]>(
            `/api/inventory/products/${found.id}/serials`
          ),
          apiClient.get<InventoryLot[]>(
            `/api/inventory/products/${found.id}/lots`
          ),
        ]);
        setSerials(serialsResp ?? []);
        setLots(lotsResp ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load inventory data');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [sku]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-muted" />
          <div className="h-64 rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex items-center gap-3 py-8 text-destructive">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Package className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-semibold">{product?.name ?? sku}</h1>
          <p className="text-sm text-muted-foreground">SKU: {sku}</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="serials">
        <TabsList>
          <TabsTrigger value="serials">
            Serials
            {serials.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {serials.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="lots">
            Lots / Batches
            {lots.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {lots.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Serials tab */}
        <TabsContent value="serials">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Serial Numbers</CardTitle>
            </CardHeader>
            <CardContent>
              {serials.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No serial numbers recorded for this product yet.
                </p>
              ) : (
                <div className="divide-y">
                  {serials.map((s) => (
                    <div key={s.id} className="flex items-center justify-between py-3">
                      <span className="font-mono text-sm">{s.serial_number}</span>
                      <div className="flex items-center gap-2">
                        {s.location && (
                          <span className="text-xs text-muted-foreground">{s.location}</span>
                        )}
                        <Badge
                          className={STATUS_COLOURS[s.status] ?? 'bg-gray-100 text-gray-800'}
                          variant="outline"
                        >
                          {s.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Lots tab */}
        <TabsContent value="lots">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lot / Batch Records</CardTitle>
            </CardHeader>
            <CardContent>
              {lots.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No lot or batch records for this product yet.
                </p>
              ) : (
                <div className="divide-y">
                  {lots.map((l) => (
                    <div key={l.id} className="flex items-center justify-between py-3">
                      <div>
                        <span className="font-mono text-sm">{l.lot_number}</span>
                        {l.batch_number && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({l.batch_number})
                          </span>
                        )}
                      </div>
                      <div className="text-right text-sm">
                        <span className="text-muted-foreground">
                          {l.quantity_remaining} / {l.quantity_received} remaining
                        </span>
                        {l.location && (
                          <span className="ml-2 text-xs text-muted-foreground">{l.location}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
