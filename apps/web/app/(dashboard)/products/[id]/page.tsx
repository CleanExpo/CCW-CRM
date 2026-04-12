'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';
import { inventoryApi } from '@/lib/api/inventory';
import { useToast } from '@/hooks/use-toast';
import { ProductSchema } from '@/components/seo/JsonLd';
import { ProductForm } from '../components/ProductForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Pencil, Package, Plus, Trash2, Sparkles } from 'lucide-react';

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

  // Attributes state
  const [attributes, setAttributes] = useState<
    Array<{ id: string; key: string; value: string; unit: string | null }>
  >([]);
  const [attrKey, setAttrKey] = useState('');
  const [attrValue, setAttrValue] = useState('');
  const [attrUnit, setAttrUnit] = useState('');
  const [savingAttr, setSavingAttr] = useState(false);
  const [extractingAttrs, setExtractingAttrs] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');

  // Variants state
  const [variants, setVariants] = useState<
    Array<{
      id: string;
      variant_sku: string;
      name: string;
      price_override: number | null;
      is_active: boolean;
    }>
  >([]);
  const [variantSku, setVariantSku] = useState('');
  const [variantName, setVariantName] = useState('');
  const [variantPrice, setVariantPrice] = useState('');
  const [savingVariant, setSavingVariant] = useState(false);

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

  const loadAttributes = useCallback(async () => {
    try {
      const data = await inventoryApi.getProductAttributes(params.id);
      setAttributes(data);
    } catch {
      /* silent — attributes are optional */
    }
  }, [params.id]);

  const loadVariants = useCallback(async () => {
    try {
      const data = await inventoryApi.getProductVariants(params.id);
      setVariants(data);
    } catch {
      /* silent — variants are optional */
    }
  }, [params.id]);

  useEffect(() => {
    loadAttributes();
    loadVariants();
  }, [loadAttributes, loadVariants]);

  const handleAddAttribute = async () => {
    if (!attrKey.trim() || !attrValue.trim()) return;
    setSavingAttr(true);
    try {
      await inventoryApi.addProductAttribute(
        params.id,
        attrKey.trim(),
        attrValue.trim(),
        attrUnit.trim() || undefined
      );
      setAttrKey('');
      setAttrValue('');
      setAttrUnit('');
      loadAttributes();
      toast({ title: 'Attribute added' });
    } catch (e: unknown) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to add attribute',
      });
    } finally {
      setSavingAttr(false);
    }
  };

  const handleExtractAttributes = async () => {
    if (!imageUrlInput.trim()) return;
    setExtractingAttrs(true);
    try {
      const result = await apiClient.post<{
        attributes: Array<{ key: string; value: string; unit?: string; confidence: number }>;
        summary: string;
      }>('/api/google-ai/vision-analyze', {
        image_url: imageUrlInput.trim(),
        product_name: product?.name,
        category: product?.category,
      });
      let added = 0;
      for (const attr of result.attributes) {
        if (attr.confidence >= 0.5 && attr.key && attr.value) {
          try {
            await inventoryApi.addProductAttribute(params.id, attr.key, attr.value, attr.unit);
            added++;
          } catch {
            /* skip duplicates */
          }
        }
      }
      setImageUrlInput('');
      loadAttributes();
      toast({
        title: 'Attributes Extracted',
        description: `Added ${added} attribute${added !== 1 ? 's' : ''} from image. ${result.summary}`,
      });
    } catch (e: unknown) {
      toast({
        variant: 'destructive',
        title: 'Extraction Failed',
        description: e instanceof Error ? e.message : 'Could not extract attributes from image.',
      });
    } finally {
      setExtractingAttrs(false);
    }
  };

  const handleDeleteAttribute = async (attrId: string) => {
    try {
      await inventoryApi.deleteProductAttribute(params.id, attrId);
      loadAttributes();
      toast({ title: 'Attribute removed' });
    } catch (e: unknown) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to remove attribute',
      });
    }
  };

  const handleAddVariant = async () => {
    if (!variantSku.trim() || !variantName.trim()) return;
    setSavingVariant(true);
    try {
      await inventoryApi.createProductVariant(params.id, {
        variant_sku: variantSku.trim(),
        name: variantName.trim(),
        price_override: variantPrice ? parseFloat(variantPrice) : undefined,
      });
      setVariantSku('');
      setVariantName('');
      setVariantPrice('');
      loadVariants();
      toast({ title: 'Variant created' });
    } catch (e: unknown) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to create variant',
      });
    } finally {
      setSavingVariant(false);
    }
  };

  const handleDeleteVariant = async (variantId: string) => {
    try {
      await inventoryApi.deleteProductVariant(params.id, variantId);
      loadVariants();
      toast({ title: 'Variant removed' });
    } catch (e: unknown) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to remove variant',
      });
    }
  };

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

        {/* Attributes & Variants */}
        <Tabs defaultValue="attributes">
          <TabsList>
            <TabsTrigger value="attributes">Attributes ({attributes.length})</TabsTrigger>
            <TabsTrigger value="variants">Variants ({variants.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="attributes">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Product Attributes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* AI Vision extraction */}
                <div className="rounded-lg border border-dashed p-3">
                  <p className="text-muted-foreground mb-2 text-xs font-medium">
                    Extract attributes from a product image (Gemini Vision)
                  </p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Paste image URL…"
                      value={imageUrlInput}
                      onChange={(e) => setImageUrlInput(e.target.value)}
                      className="text-sm"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleExtractAttributes}
                      disabled={extractingAttrs || !imageUrlInput.trim()}
                    >
                      <Sparkles
                        className={`mr-1.5 h-3.5 w-3.5 ${extractingAttrs ? 'animate-pulse' : ''}`}
                      />
                      {extractingAttrs ? 'Extracting…' : 'Extract'}
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[140px] flex-1 space-y-1">
                    <Label className="text-xs">Key</Label>
                    <Input
                      placeholder="e.g. Colour"
                      value={attrKey}
                      onChange={(e) => setAttrKey(e.target.value)}
                    />
                  </div>
                  <div className="min-w-[140px] flex-1 space-y-1">
                    <Label className="text-xs">Value</Label>
                    <Input
                      placeholder="e.g. Red"
                      value={attrValue}
                      onChange={(e) => setAttrValue(e.target.value)}
                    />
                  </div>
                  <div className="w-24 space-y-1">
                    <Label className="text-xs">Unit</Label>
                    <Input
                      placeholder="e.g. mm"
                      value={attrUnit}
                      onChange={(e) => setAttrUnit(e.target.value)}
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={handleAddAttribute}
                    disabled={savingAttr || !attrKey.trim() || !attrValue.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {attributes.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No attributes added yet.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-muted-foreground text-xs uppercase">
                        <th className="py-1 text-left">Key</th>
                        <th className="py-1 text-left">Value</th>
                        <th className="py-1 text-left">Unit</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {attributes.map((a) => (
                        <tr key={a.id} className="border-t">
                          <td className="py-1.5 font-medium">{a.key}</td>
                          <td className="py-1.5">{a.value}</td>
                          <td className="text-muted-foreground py-1.5">{a.unit ?? '—'}</td>
                          <td className="py-1.5 text-right">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeleteAttribute(a.id)}
                            >
                              <Trash2 className="text-destructive h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="variants">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Product Variants</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[140px] flex-1 space-y-1">
                    <Label className="text-xs">Variant SKU</Label>
                    <Input
                      placeholder="e.g. SKU-001-RED"
                      value={variantSku}
                      onChange={(e) => setVariantSku(e.target.value)}
                    />
                  </div>
                  <div className="min-w-[140px] flex-1 space-y-1">
                    <Label className="text-xs">Name</Label>
                    <Input
                      placeholder="e.g. Red Large"
                      value={variantName}
                      onChange={(e) => setVariantName(e.target.value)}
                    />
                  </div>
                  <div className="w-36 space-y-1">
                    <Label className="text-xs">Price Override (AUD)</Label>
                    <Input
                      type="number"
                      placeholder="Optional"
                      value={variantPrice}
                      onChange={(e) => setVariantPrice(e.target.value)}
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={handleAddVariant}
                    disabled={savingVariant || !variantSku.trim() || !variantName.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {variants.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No variants created yet.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-muted-foreground text-xs uppercase">
                        <th className="py-1 text-left">SKU</th>
                        <th className="py-1 text-left">Name</th>
                        <th className="py-1 text-left">Price</th>
                        <th className="py-1 text-left">Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {variants.map((v) => (
                        <tr key={v.id} className="border-t">
                          <td className="py-1.5 font-mono text-xs">{v.variant_sku}</td>
                          <td className="py-1.5">{v.name}</td>
                          <td className="py-1.5">
                            {v.price_override != null ? formatCurrency(v.price_override) : '—'}
                          </td>
                          <td className="py-1.5">
                            <Badge
                              variant={v.is_active ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {v.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                          <td className="py-1.5 text-right">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeleteVariant(v.id)}
                            >
                              <Trash2 className="text-destructive h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit dialog */}
      <ProductForm
        product={product}
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
