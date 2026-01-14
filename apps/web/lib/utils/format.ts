/**
 * Currency formatting utilities
 * Extracted to avoid recreation on every render
 */

const currencyFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
});

/**
 * Format a number as Australian currency
 * Memoized formatter instance to avoid recreation
 */
export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

/**
 * Format a date for display
 */
export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString();
}

/**
 * Check if a date is in the past (expired)
 */
export function isExpired(date: string | null | undefined): boolean {
  if (!date) return false;
  return new Date(date) < new Date();
}
