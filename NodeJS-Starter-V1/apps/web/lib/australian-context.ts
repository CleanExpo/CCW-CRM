/**
 * Australian Context Utilities
 *
 * Utilities for formatting dates, currency, and phone numbers in Australian format.
 */

/**
 * Format date in Australian format (DD/MM/YYYY)
 */
export function formatDateAU(date: Date): string {
  return new Intl.DateTimeFormat('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}

/**
 * Format currency in Australian Dollars (AUD)
 */
export function formatCurrencyAUD(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD'
  }).format(amount);
}

/**
 * Format phone number in Australian format (04XX XXX XXX)
 */
export function formatPhoneAU(phone: string): string {
  // Remove any non-digit characters
  const cleaned = phone.replace(/\D/g, '');

  // Format as 04XX XXX XXX
  if (cleaned.length === 10 && cleaned.startsWith('04')) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }

  // Return as-is if not a valid mobile number
  return phone;
}
