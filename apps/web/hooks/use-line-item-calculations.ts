/**
 * React hook for line item calculations with business configuration.
 *
 * This hook provides calculation utilities that automatically fetch
 * and use the business configuration (tax rate, tax name, etc.) from
 * the backend. It's designed to be used in Order, Quote, and Purchase
 * Order forms.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { calculateLineTotal, calculateUnitPrice, calculateTotals } from '@/lib/utils/calculations';
import { apiClient } from '@/lib/api/client';

/**
 * Business configuration from backend.
 */
export interface BusinessConfig {
  taxRate: number;
  taxName: string;
  quoteValidityDays: number;
}

/**
 * Generic line item interface.
 */
export interface LineItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  [key: string]: unknown; // Allow additional properties
}

/**
 * Hook return type.
 */
export interface UseLineItemCalculationsReturn {
  config: BusinessConfig;
  loading: boolean;
  error: string | null;
  updateQuantity: (item: LineItem, quantity: number) => LineItem;
  updateUnitPrice: (item: LineItem, unitPrice: number) => LineItem;
  updateLineTotal: (item: LineItem, lineTotal: number) => LineItem;
  calculateTotalsForItems: (items: LineItem[]) => {
    subtotal: number;
    tax: number;
    total: number;
  };
  refreshConfig: () => Promise<void>;
}

/**
 * Default business configuration (fallback).
 */
const DEFAULT_CONFIG: BusinessConfig = {
  taxRate: 0.1, // 10% GST
  taxName: 'GST',
  quoteValidityDays: 30,
};

/**
 * React hook for line item calculations.
 *
 * Fetches business configuration on mount and provides calculation
 * utilities that automatically recalculate dependent values.
 *
 * @returns Calculation utilities and business configuration
 *
 * @example
 * const { config, updateQuantity, calculateTotalsForItems } = useLineItemCalculations();
 *
 * // Update quantity (recalculates line_total)
 * const updatedItem = updateQuantity(item, 10);
 *
 * // Calculate totals with tax
 * const totals = calculateTotalsForItems(items);
 * console.log(totals.subtotal, totals.tax, totals.total);
 */
export function useLineItemCalculations(): UseLineItemCalculationsReturn {
  const [config, setConfig] = useState<BusinessConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch business configuration from backend.
   */
  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<BusinessConfig>('/api/config/business');
      setConfig(response);
    } catch (err: unknown) {
      console.error('Failed to fetch business config:', err);
      setError(err instanceof Error ? err.message : 'Failed to load business configuration');
      // Keep using default config on error
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch config on mount
  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  /**
   * Update quantity and recalculate line total.
   *
   * Mode A: Enter quantity → calculate line_total from unit_price
   */
  const updateQuantity = useCallback((item: LineItem, quantity: number): LineItem => {
    const newLineTotal = calculateLineTotal(quantity, item.unit_price);
    return {
      ...item,
      quantity,
      line_total: newLineTotal,
    };
  }, []);

  /**
   * Update unit price and recalculate line total.
   *
   * Mode A: Enter unit_price → calculate line_total from quantity
   */
  const updateUnitPrice = useCallback((item: LineItem, unitPrice: number): LineItem => {
    const newLineTotal = calculateLineTotal(item.quantity, unitPrice);
    return {
      ...item,
      unit_price: unitPrice,
      line_total: newLineTotal,
    };
  }, []);

  /**
   * Update line total and recalculate unit price (bidirectional).
   *
   * Mode B: Enter line_total → calculate unit_price from quantity
   */
  const updateLineTotal = useCallback((item: LineItem, lineTotal: number): LineItem => {
    const newUnitPrice = item.quantity > 0 ? calculateUnitPrice(lineTotal, item.quantity) : 0;
    return {
      ...item,
      line_total: lineTotal,
      unit_price: newUnitPrice,
    };
  }, []);

  /**
   * Calculate subtotal, tax, and total for all line items.
   *
   * Uses the current business configuration's tax rate.
   */
  const calculateTotalsForItems = useCallback(
    (items: LineItem[]) => {
      const lineItems = items.map((item) => ({
        quantity: item.quantity,
        unitPrice: item.unit_price,
      }));

      return calculateTotals(lineItems, config.taxRate, true);
    },
    [config.taxRate]
  );

  return {
    config,
    loading,
    error,
    updateQuantity,
    updateUnitPrice,
    updateLineTotal,
    calculateTotalsForItems,
    refreshConfig: fetchConfig,
  };
}

/**
 * Type guard to check if an object is a valid LineItem.
 */
export function isValidLineItem(item: unknown): item is LineItem {
  return !!(
    item &&
    typeof item === 'object' &&
    'product_id' in item &&
    'quantity' in item &&
    'unit_price' in item &&
    'line_total' in item &&
    typeof item.quantity === 'number' &&
    typeof item.unit_price === 'number' &&
    typeof item.line_total === 'number'
  );
}
