"use client";

import { useState, useMemo } from "react";
import { Minus, Plus, X, ShoppingCart } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CartItem {
  id: string;
  sku: string;
  name: string;
  price: number;
  quantity: number;
  stock: number;
}

interface CartManagerProps {
  items: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  taxRate?: number;
  showTax?: boolean;
}

export function CartManager({
  items,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  taxRate = 0.1, // 10% default tax
  showTax = true,
}: CartManagerProps) {
  const { subtotal, tax, total, itemCount } = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const tax = showTax ? subtotal * taxRate : 0;
    const total = subtotal + tax;
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    return { subtotal, tax, total, itemCount };
  }, [items, taxRate, showTax]);

  const handleQuantityChange = (productId: string, newQuantity: number) => {
    const item = items.find((i) => i.id === productId);
    if (!item) return;

    // Validate against stock
    if (newQuantity > item.stock) {
      alert(`Only ${item.stock} units available in stock`);
      return;
    }

    if (newQuantity < 1) {
      onRemoveItem(productId);
    } else {
      onUpdateQuantity(productId, newQuantity);
    }
  };

  if (items.length === 0) {
    return (
      <Card className="p-8">
        <div className="flex flex-col items-center justify-center text-center">
          <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Cart is empty</h3>
          <p className="text-sm text-muted-foreground">
            Search for products to add to the cart
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          <h2 className="text-lg font-semibold">
            Cart <span className="text-muted-foreground">({itemCount} items)</span>
          </h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearCart}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          Clear All
        </Button>
      </div>

      {/* Cart Items */}
      <ScrollArea className="max-h-96">
        <div className="divide-y">
          {items.map((item) => (
            <div key={item.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">SKU: {item.sku}</p>
                  <p className="text-sm font-semibold mt-2">
                    ${item.price.toFixed(2)} each
                  </p>
                </div>

                {/* Quantity Controls */}
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>

                    <Input
                      type="number"
                      min="1"
                      max={item.stock}
                      value={item.quantity}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 1;
                        handleQuantityChange(item.id, value);
                      }}
                      className="w-16 h-8 text-center"
                    />

                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                      disabled={item.quantity >= item.stock}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => onRemoveItem(item.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <p className="text-sm font-semibold">
                    ${(item.price * item.quantity).toFixed(2)}
                  </p>

                  {item.quantity >= item.stock && (
                    <p className="text-xs text-yellow-600">Max stock reached</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Cart Summary */}
      <div className="p-4 border-t bg-muted/30">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal:</span>
            <span className="font-medium">${subtotal.toFixed(2)}</span>
          </div>

          {showTax && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Tax ({(taxRate * 100).toFixed(0)}%):
              </span>
              <span className="font-medium">${tax.toFixed(2)}</span>
            </div>
          )}

          <Separator className="my-2" />

          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold">Total:</span>
            <span className="text-2xl font-bold">${total.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
