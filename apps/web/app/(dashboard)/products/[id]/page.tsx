'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';
import { useToast } from '@/hooks/use-toast';
import { ProductSchema } from '@/components/seo/JsonLd';
import { ProductForm } from '../components/ProductForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Pencil, Package } from 'lucide-react';

type ProductCategory =
  | 'heavy_machinery'
  | 'hand_tools'
  | 'power_tools'
  | 'safety_equipment'
  | 'building_materials'
  | 'electrical'
  | 'plumbing'
  | 'accessories';

const categoryLabels: Record<ProductCategory, string> = {
  heavy_machinery: 'Heavy Machinery',
  hand_tools: 'Hand Tools',
  power_tools: 'Power Tools',
  safety_equipment: 'Safety Equipment',
  building_materials: 'Building Materials',
  electrical: 'Electrical',
  plumbing: 'Plumbing',
  accessories: 'Accessories',
};

interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category: ProductCategory;
  price: number;
  cost: number;
  stock: number;
  warehouse_location: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  const loadProduct = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<Product>(`/api/products/${params.id}`);
      setProduct(data);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Product not found';
      toast({ variant: 'destructive', title: 'Error', description: message });
      router.push('/products');
    } finally {
      setLoading(false);
    }
  }, [params.id, router, toast]);

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-24" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="mt-1 h-5 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!product) return null;

  const stockStatus: 'InStock' | 'OutOfStock' | 'LimitedAvailability' =
    product.stock === 0 ? 'OutOfStock' : product.stock < 10 ? 'LimitedAvailability' : 'InStock';

  const categoryLabel = categoryLabels[product.category] ?? product.category.replace(/_/g, ' ');

  return (
    <>
      {/* SEO: ProductSchema JSON-LD with Product, Offer, AggregateRating */}
      <ProductSchema
        name={product.name}
        description={product.description ?? undefined}
        sku={product.sku}
        price={product.price.toString()}
        availability={stockStatus}
        category={categoryLabel}
        url={`https://ccwonline.com.au/products/${product.id}`}
      />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" asChild>
              <Link href="/products">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Products
              </Link>
            </Button>
            <Badge variant={product.is_active ? 'default' : 'secondary'}>
              {product.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <Button onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit Product
          </Button>
        </div>

        {/* Main detail card */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-4">
              <div className="bg-muted rounded-lg p-3">
                <Package className="text-muted-foreground h-8 w-8" />
              </div>
              <div>
                <CardTitle className="text-2xl">{product.name}</CardTitle>
                <p className="text-muted-foreground mt-1 font-mono text-sm">SKU: {product.sku}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Description */}
            {product.description && (
              <div>
                <h3 className="text-muted-foreground mb-1 text-sm font-semibold tracking-wide uppercase">
                  Description
                </h3>
                <p className="text-sm leading-relaxed">{product.description}</p>
              </div>
            )}

            <Separator />

            {/* Key stats grid */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs tracking-wide uppercase">Price</p>
                <p className="text-primary text-xl font-bold">{formatCurrency(product.price)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs tracking-wide uppercase">Cost</p>
                <p className="text-xl font-bold">{formatCurrency(product.cost)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs tracking-wide uppercase">Stock</p>
                <p
                  className={`text-xl font-bold ${
                    product.stock === 0
                      ? 'text-destructive'
                      : product.stock < 10
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : ''
                  }`}
                >
                  {product.stock} units
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs tracking-wide uppercase">Margin</p>
                <p className="text-xl font-bold">
                  {product.price > 0
                    ? `${(((product.price - product.cost) / product.price) * 100).toFixed(1)}%`
                    : '—'}
                </p>
              </div>
            </div>

            <Separator />

            {/* Details */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs tracking-wide uppercase">Category</p>
                <Badge variant="outline" className="capitalize">
                  {categoryLabels[product.category] ?? product.category.replace(/_/g, ' ')}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs tracking-wide uppercase">
                  Warehouse Location
                </p>
                <p className="text-sm">{product.warehouse_location ?? 'Not assigned'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs tracking-wide uppercase">Created</p>
                <p className="text-sm">{formatDate(product.created_at)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs tracking-wide uppercase">
                  Last Updated
                </p>
                <p className="text-sm">{formatDate(product.updated_at)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit dialog */}
      <ProductForm
        product={product as any}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={() => {
          setEditOpen(false);
          loadProduct();
        }}
      />
    </>
  );
}
