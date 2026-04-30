'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Plus, Calculator } from 'lucide-react';
import { LocationAwareProductSelect } from '@/components/inventory/LocationAwareProductSelect';
import { useLineItemCalculations } from '@/hooks/use-line-item-calculations';
import { formatCurrency } from '@/lib/utils/calculations';
import type { PurchaseOrderItem } from '../types';

interface PurchaseOrderLineItemsProps {
  items: PurchaseOrderItem[];
  onChange: (items: PurchaseOrderItem[]) => void;
  errors?: string[];
  selectedLocation: string;
}

export function PurchaseOrderLineItems({
  items,
  onChange,
  errors,
  selectedLocation,
}: PurchaseOrderLineItemsProps) {
  const { updateQuantity, updateUnitPrice, updateLineTotal } = useLineItemCalculations();

  const handleAddItem = () => {
    const newItem: PurchaseOrderItem = {
      product_id: '',
      quantity: 1,
      quantity_received: 0,
      unit_cost: 0,
      subtotal: 0,
      calculationMode: 'unit_cost', // Default to unit cost entry mode
    };
    onChange([...items, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems);
  };

  const handleProductChange = (
    index: number,
    product: { id: string; name: string; sku: string; cost?: number; price?: number }
  ) => {
    const newItems = [...items];
    const item = newItems[index];

    // Product selector returns `price`; keep `cost` as backward-compatible fallback.
    const defaultUnitCost = product.cost ?? product.price ?? 0;

    newItems[index] = {
      ...item,
      product_id: product.id,
      product_name: product.name,
      product_sku: product.sku,
      unit_cost: defaultUnitCost,
      subtotal: item.quantity * defaultUnitCost,
    };
    onChange(newItems);
  };

  const handleQuantityChange = (index: number, quantity: string) => {
    const qty = parseInt(quantity) || 0;
    const newItems = [...items];
    const item = newItems[index];

    // Convert PO item to LineItem format for calculation
    const lineItem = {
      ...item,
      unit_price: item.unit_cost,
      line_total: item.subtotal,
    };

    // Recalculate based on current mode
    let updated;
    if (item.calculationMode === 'unit_cost') {
      updated = updateQuantity(lineItem, qty);
    } else {
      // In subtotal mode, changing quantity recalculates unit_cost
      updated = {
        ...updateQuantity(lineItem, qty),
        unit_price: qty > 0 ? item.subtotal / qty : 0,
      };
    }

    // Convert back to PO item format
    newItems[index] = {
      ...item,
      quantity: updated.quantity,
      unit_cost: updated.unit_price,
      subtotal: updated.line_total,
    };
    onChange(newItems);
  };

  const handleUnitCostChange = (index: number, cost: string) => {
    const unitCost = parseFloat(cost) || 0;
    const newItems = [...items];
    const item = newItems[index];

    // Convert to LineItem format
    const lineItem = {
      ...item,
      unit_price: item.unit_cost,
      line_total: item.subtotal,
    };

    const updated = updateUnitPrice(lineItem, unitCost);

    // Convert back to PO format
    newItems[index] = {
      ...item,
      unit_cost: updated.unit_price,
      subtotal: updated.line_total,
    };
    onChange(newItems);
  };

  const handleSubtotalChange = (index: number, subtotal: string) => {
    const subtotalValue = parseFloat(subtotal) || 0;
    const newItems = [...items];
    const item = newItems[index];

    // Convert to LineItem format
    const lineItem = {
      ...item,
      unit_price: item.unit_cost,
      line_total: item.subtotal,
    };

    const updated = updateLineTotal(lineItem, subtotalValue);

    // Convert back to PO format
    newItems[index] = {
      ...item,
      unit_cost: updated.unit_price,
      subtotal: updated.line_total,
    };
    onChange(newItems);
  };

  const handleToggleCalculationMode = (index: number) => {
    const newItems = [...items];
    const item = newItems[index];

    // Toggle between modes
    newItems[index] = {
      ...item,
      calculationMode: item.calculationMode === 'unit_cost' ? 'subtotal' : 'unit_cost',
    };
    onChange(newItems);
  };

  const total = items.reduce((sum, item) => sum + item.subtotal, 0);

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
        <div className="text-destructive text-sm">
          {errors.map((error, i) => (
            <div key={i}>{error}</div>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-muted-foreground text-sm">No items added yet</p>
          <Button type="button" variant="ghost" size="sm" onClick={handleAddItem} className="mt-2">
            <Plus className="mr-2 h-4 w-4" />
            Add your first item
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={index} className="grid grid-cols-12 items-start gap-3 rounded-md border p-3">
              {/* Product Selection - 5 cols */}
              <div className="col-span-5">
                <label className="text-muted-foreground mb-1 block text-xs">Product</label>
                <LocationAwareProductSelect
                  selectedLocation={selectedLocation}
                  value={item.product_id}
                  onSelect={(product) => handleProductChange(index, product)}
                />
                {item.product_sku && (
                  <p className="text-muted-foreground mt-1 text-xs">SKU: {item.product_sku}</p>
                )}
              </div>

              {/* Quantity - 2 cols */}
              <div className="col-span-2">
                <label className="text-muted-foreground mb-1 block text-xs">Quantity</label>
                <Input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => handleQuantityChange(index, e.target.value)}
                />
              </div>

              {/* Unit Cost - 2 cols */}
              <div className="col-span-2">
                <label className="text-muted-foreground mb-1 flex items-center justify-between text-xs">
                  <span>Unit Cost</span>
                  {item.calculationMode === 'subtotal' && (
                    <span className="rounded bg-blue-100 px-1 text-[10px] text-blue-800">
                      Calculated
                    </span>
                  )}
                </label>
                {item.calculationMode === 'unit_cost' ? (
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.unit_cost}
                    onChange={(e) => handleUnitCostChange(index, e.target.value)}
                  />
                ) : (
                  <div className="bg-muted flex h-9 items-center rounded-md border px-3 text-sm font-medium">
                    ${item.unit_cost.toFixed(2)}
                  </div>
                )}
              </div>

              {/* Subtotal - 2 cols */}
              <div className="col-span-2">
                <label className="text-muted-foreground mb-1 flex items-center justify-between text-xs">
                  <span>Subtotal</span>
                  {item.calculationMode === 'unit_cost' && (
                    <span className="rounded bg-blue-100 px-1 text-[10px] text-blue-800">
                      Calculated
                    </span>
                  )}
                </label>
                {item.calculationMode === 'subtotal' ? (
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.subtotal}
                    onChange={(e) => handleSubtotalChange(index, e.target.value)}
                  />
                ) : (
                  <div className="bg-muted flex h-9 items-center rounded-md border px-3 text-sm font-medium">
                    {formatCurrency(item.subtotal)}
                  </div>
                )}
              </div>

              {/* Toggle & Remove - 1 col */}
              <div className="col-span-1 flex items-end gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToggleCalculationMode(index)}
                  title={
                    item.calculationMode === 'unit_cost'
                      ? 'Switch to subtotal entry mode'
                      : 'Switch to unit cost entry mode'
                  }
                  className="h-9 w-9 p-0"
                >
                  <Calculator className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveItem(index)}
                  className="h-9 w-9 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          <div className="flex justify-end border-t pt-4">
            <div className="text-right">
              <div className="text-muted-foreground text-sm">Subtotal (before tax & shipping)</div>
              <div className="text-2xl font-bold">{formatCurrency(total)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
