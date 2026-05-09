"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Plus } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { LocationAwareProductSelect } from "@/components/inventory/LocationAwareProductSelect";
import { useLineItemCalculations } from "@/hooks/use-line-item-calculations";
import { formatCurrency } from "@/lib/utils/calculations";

interface Product {
  id: string;
  sku: string;
  name: string;
  price: number;
  stock: number;
}

interface ProductResponse {
  items: Product[];
}

export interface LineItem {
  id?: string;
  product_id: string;
  product_name?: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  [key: string]: unknown;
}

interface OrderLineItemsProps {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  errors?: string[];
  selectedLocation?: string;
}

export function OrderLineItems({ items, onChange, errors, selectedLocation = "brisbane" }: OrderLineItemsProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const { updateQuantity, updateUnitPrice } = useLineItemCalculations();

  useEffect(() => {
    async function loadProducts() {
      try {
        const response = await apiClient.get<ProductResponse>("/api/products?page=1&page_size=100");
        setProducts(response.items || []);
      } catch (error: unknown) {
        console.error("Failed to load products:", error);
      }
    }
    loadProducts();
  }, []);

  const handleAddItem = () => {
    const newItem: LineItem = {
      id:
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `line-${Date.now()}`,
      product_id: "",
      quantity: 1,
      unit_price: 0,
      line_total: 0,
    };
    onChange([...items, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems);
  };

  const handleProductChange = (
    index: number,
    product: { id: string; name: string; price: number }
  ) => {
    const newItems = [...items];
    const unit = Number(product.price);
    newItems[index] = {
      ...newItems[index],
      product_id: product.id,
      product_name: product.name,
      unit_price: unit,
      line_total: newItems[index].quantity * unit,
    };
    onChange(newItems);
  };

  const handleQuantityChange = (index: number, quantity: string) => {
    const qty = parseInt(quantity) || 0;
    const newItems = [...items];
    newItems[index] = updateQuantity(newItems[index], qty);
    onChange(newItems);
  };

  const handleUnitPriceChange = (index: number, price: string) => {
    const unitPrice = parseFloat(price) || 0;
    const newItems = [...items];
    newItems[index] = updateUnitPrice(newItems[index], unitPrice);
    onChange(newItems);
  };

  const total = items.reduce((sum, item) => sum + item.line_total, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Line Items</h3>
        <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
          <Plus className="mr-2 h-4 w-4" />
          Add Item
        </Button>
      </div>

      {errors && errors.length > 0 && (
        <div className="text-sm text-destructive">
          {errors.map((error, i) => (
            <div key={i}>{error}</div>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No items added yet</p>
          <Button type="button" variant="ghost" size="sm" onClick={handleAddItem} className="mt-2">
            <Plus className="mr-2 h-4 w-4" />
            Add your first item
          </Button>
        </div>
      ) : (
        <>
          <div className="max-h-[min(55vh,26rem)] space-y-3 overflow-y-auto overflow-x-hidden pr-1">
            {items.map((item, index) => {
              const product = products.find((p) => p.id === item.product_id);
              const lowStock = product && item.quantity > product.stock;
              const rowKey = item.id ?? `idx-${index}`;

              return (
                <div
                  key={rowKey}
                  className="grid grid-cols-1 items-start gap-3 rounded-md border bg-background p-3 sm:grid-cols-12 sm:gap-3"
                >
                  <div className="sm:col-span-5">
                    <label className="text-muted-foreground mb-1 block text-xs">Product</label>
                    <LocationAwareProductSelect
                      selectedLocation={selectedLocation}
                      value={item.product_id}
                      onSelect={(p) => handleProductChange(index, p)}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-muted-foreground mb-1 block text-xs">Quantity</label>
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleQuantityChange(index, e.target.value)}
                      className={lowStock ? 'border-destructive' : ''}
                    />
                    {lowStock && (
                      <p className="text-destructive mt-1 text-xs">
                        Low stock! Only {product?.stock} available
                      </p>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-muted-foreground mb-1 block text-xs">Unit Price</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.unit_price}
                      onChange={(e) => handleUnitPriceChange(index, e.target.value)}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-muted-foreground mb-1 block text-xs">Subtotal</label>
                    <div className="flex h-9 items-center rounded-md border bg-muted px-3 text-sm font-medium">
                      {formatCurrency(item.line_total)}
                    </div>
                  </div>

                  <div className="flex justify-end sm:col-span-1 sm:items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveItem(index)}
                      className="h-9"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end border-t pt-4">
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Order Total</div>
              <div className="text-2xl font-bold">{formatCurrency(total)}</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
