"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Plus } from "lucide-react";
import { apiClient } from "@/lib/api/client";

interface Product {
  id: string;
  sku: string;
  name: string;
  price: number;
  stock: number;
}

export interface LineItem {
  id?: string;
  product_id: string;
  product_name?: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

interface QuoteLineItemsProps {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  errors?: string[];
}

export function QuoteLineItems({ items, onChange, errors }: QuoteLineItemsProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  useEffect(() => {
    async function loadProducts() {
      try {
        const response = await apiClient.get<any>("/api/products?page=1&page_size=100");
        setProducts(response.items || []);
      } catch (error) {
        console.error("Failed to load products:", error);
      } finally {
        setLoadingProducts(false);
      }
    }
    loadProducts();
  }, []);

  const handleAddItem = () => {
    const newItem: LineItem = {
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

  const handleProductChange = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      product_id: productId,
      product_name: product.name,
      unit_price: Number(product.price),
      line_total: newItems[index].quantity * Number(product.price),
    };
    onChange(newItems);
  };

  const handleQuantityChange = (index: number, quantity: string) => {
    const qty = parseInt(quantity) || 0;
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      quantity: qty,
      line_total: qty * newItems[index].unit_price,
    };
    onChange(newItems);
  };

  const handleUnitPriceChange = (index: number, price: string) => {
    const unitPrice = parseFloat(price) || 0;
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      unit_price: unitPrice,
      line_total: newItems[index].quantity * unitPrice,
    };
    onChange(newItems);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(value);
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
        <div className="space-y-3">
          {items.map((item, index) => {
            const product = products.find((p) => p.id === item.product_id);
            const lowStock = product && item.quantity > product.stock;

            return (
              <div
                key={index}
                className="grid grid-cols-12 gap-3 items-start rounded-md border p-3"
              >
                <div className="col-span-5">
                  <label className="text-xs text-muted-foreground mb-1 block">Product</label>
                  <Select
                    value={item.product_id}
                    onValueChange={(value) => handleProductChange(index, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {loadingProducts ? (
                        <SelectItem value="loading" disabled>
                          Loading...
                        </SelectItem>
                      ) : (
                        products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.sku} - {product.name} (Stock: {product.stock})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Quantity</label>
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => handleQuantityChange(index, e.target.value)}
                    className={lowStock ? "border-destructive" : ""}
                  />
                  {lowStock && (
                    <p className="text-xs text-destructive mt-1">
                      Low stock! Only {product?.stock} available
                    </p>
                  )}
                </div>

                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Unit Price</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.unit_price}
                    onChange={(e) => handleUnitPriceChange(index, e.target.value)}
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Subtotal</label>
                  <div className="flex items-center h-9 px-3 rounded-md border bg-muted text-sm font-medium">
                    {formatCurrency(item.line_total)}
                  </div>
                </div>

                <div className="col-span-1 flex items-end">
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

          <div className="flex justify-end pt-4 border-t">
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Quote Total</div>
              <div className="text-2xl font-bold">{formatCurrency(total)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
