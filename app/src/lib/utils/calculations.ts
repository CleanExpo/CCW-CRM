/**
 * Shared calculation utilities for Orders, Quotes, and Purchase Orders.
 *
 * This module provides DRY calculation functions to eliminate duplication
 * across different parts of the ERP system. All calculations maintain
 * 2 decimal place precision for currency amounts.
 */

/**
 * Type definition for totals calculation result.
 */
export interface CalculationTotals {
  subtotal: number;
  tax: number;
  total: number;
}

/**
 * Calculate line total from quantity and unit price.
 *
 * @param quantity - Number of units (must be >= 0)
 * @param unitPrice - Price per unit (must be >= 0)
 * @returns Line total rounded to 2 decimal places
 * @throws Error if quantity or unitPrice is negative
 *
 * @example
 * calculateLineTotal(5, 10.50); // 52.50
 */
export function calculateLineTotal(quantity: number, unitPrice: number): number {
  if (quantity < 0 || unitPrice < 0) {
    throw new Error("Quantity and unit price must be >= 0");
  }

  // Multiply first, then round to avoid floating point precision issues
  return Math.round(quantity * unitPrice * 100) / 100;
}

/**
 * Calculate unit price from line total (bidirectional calculation).
 *
 * This function enables the reverse calculation: given a total amount
 * and quantity, calculate what the unit price should be.
 *
 * @param lineTotal - Total amount for the line (must be >= 0)
 * @param quantity - Number of units (must be > 0)
 * @returns Unit price rounded to 2 decimal places
 * @throws Error if quantity is <= 0 (division by zero)
 * @throws Error if lineTotal is negative
 *
 * @example
 * calculateUnitPrice(100.00, 5); // 20.00
 * calculateUnitPrice(100.00, 3); // 33.33
 */
export function calculateUnitPrice(lineTotal: number, quantity: number): number {
  if (quantity <= 0) {
    throw new Error("Quantity must be > 0 for division");
  }
  if (lineTotal < 0) {
    throw new Error("Line total must be >= 0");
  }

  return Math.round((lineTotal / quantity) * 100) / 100;
}

/**
 * Calculate subtotal, tax, and total from line items.
 *
 * @param lineItems - Array of objects with quantity and unitPrice
 * @param taxRate - Tax rate as decimal (e.g., 0.10 for 10%)
 * @param taxEnabled - Whether to apply tax (default: true)
 * @returns Object with subtotal, tax, and total
 * @throws Error if taxRate is negative
 *
 * @example
 * const items = [
 *   { quantity: 5, unitPrice: 10.00 },
 *   { quantity: 3, unitPrice: 20.00 }
 * ];
 * calculateTotals(items, 0.10);
 * // { subtotal: 110.00, tax: 11.00, total: 121.00 }
 */
export function calculateTotals(
  lineItems: Array<{ quantity: number; unitPrice: number }>,
  taxRate: number,
  taxEnabled: boolean = true
): CalculationTotals {
  if (taxRate < 0) {
    throw new Error("Tax rate must be >= 0");
  }

  const subtotal = lineItems.reduce((sum, item) => {
    return sum + calculateLineTotal(item.quantity, item.unitPrice);
  }, 0);

  // Round subtotal to 2 decimal places
  const roundedSubtotal = Math.round(subtotal * 100) / 100;

  const tax = taxEnabled
    ? Math.round(roundedSubtotal * taxRate * 100) / 100
    : 0;

  const total = Math.round((roundedSubtotal + tax) * 100) / 100;

  return {
    subtotal: roundedSubtotal,
    tax,
    total,
  };
}

/**
 * Calculate profit margin: (price - cost) / price × 100.
 *
 * @param price - Selling price (must be > 0)
 * @param cost - Cost price (must be >= 0)
 * @returns Object with marginAmount and marginPercentage
 * @throws Error if price <= 0 or cost < 0
 * @throws Error if cost > price (negative margin)
 *
 * @example
 * calculateMargin(100.00, 75.00);
 * // { marginAmount: 25.00, marginPercentage: 25.00 }
 */
export function calculateMargin(
  price: number,
  cost: number
): { marginAmount: number; marginPercentage: number } {
  if (price <= 0) {
    throw new Error("Price must be > 0");
  }
  if (cost < 0) {
    throw new Error("Cost must be >= 0");
  }
  if (cost > price) {
    throw new Error("Cost cannot exceed price (negative margin)");
  }

  const marginAmount = Math.round((price - cost) * 100) / 100;
  const marginPercentage = Math.round(((marginAmount / price) * 100) * 100) / 100;

  return {
    marginAmount,
    marginPercentage,
  };
}

/**
 * Validate that price is greater than or equal to cost.
 *
 * This is used in form validators to ensure products maintain
 * positive or zero margins.
 *
 * @param price - Selling price
 * @param cost - Cost price (can be null/undefined)
 * @returns True if valid, false otherwise
 *
 * @example
 * validatePriceVsCost(100, 75); // true
 * validatePriceVsCost(50, 75);  // false
 * validatePriceVsCost(100, null); // true
 */
export function validatePriceVsCost(
  price: number,
  cost: number | null | undefined
): boolean {
  if (cost === null || cost === undefined) {
    return true;
  }
  return price >= cost;
}

/**
 * Format a number as Australian currency (AUD).
 *
 * @param value - Number to format
 * @returns Formatted currency string
 *
 * @example
 * formatCurrency(1234.56); // "$1,234.56"
 * formatCurrency(0); // "$0.00"
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Parse a currency string to a number.
 *
 * Removes currency symbols, commas, and whitespace before parsing.
 *
 * @param value - Currency string to parse
 * @returns Parsed number, or 0 if invalid
 *
 * @example
 * parseCurrency("$1,234.56"); // 1234.56
 * parseCurrency("1234.56"); // 1234.56
 * parseCurrency("invalid"); // 0
 */
export function parseCurrency(value: string): number {
  const cleaned = value.replace(/[$,\s]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}
