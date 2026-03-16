/**
 * PHASE AI: Form Auto-Fill Hook
 *
 * Provides AI-powered form auto-fill suggestions based on customer history
 * and order patterns to reduce manual data entry.
 *
 * Usage:
 * ```tsx
 * const { suggestions, confidence, loading, fetchSuggestions } = useFormAutoFill({
 *   formType: "order",
 *   customerId: selectedCustomer?.id,
 * });
 *
 * useEffect(() => {
 *   if (selectedCustomer) {
 *     fetchSuggestions();
 *   }
 * }, [selectedCustomer, fetchSuggestions]);
 * ```
 */

import { useCallback, useState } from 'react';
import { apiClient } from '@/lib/api/client';

interface FormAutoFillOptions {
  /** Type of form: "order", "quote", "purchase_order", "customer" */
  formType: 'order' | 'quote' | 'purchase_order' | 'customer';

  /** Customer ID for order/quote forms */
  customerId?: string;

  /** Supplier ID for purchase order forms */
  supplierId?: string;

  /** Email for duplicate detection (customer forms) */
  email?: string;

  /** Name for duplicate detection (customer forms) */
  name?: string;

  /** Phone for duplicate detection (customer forms) */
  phone?: string;

  /** Maximum number of product suggestions */
  limit?: number;
}

interface AutoFillSuggestions {
  /** Suggested values for form fields */
  shipping_address?: {
    address: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };

  /** Suggested products with quantities */
  products?: Array<{
    product_id: string;
    sku: string;
    name: string;
    price: number;
    avg_quantity: number;
    count: number;
  }>;

  /** Suggested notes */
  notes?: string;

  /** Expected delivery date (for POs) */
  expected_delivery?: string;

  /** Valid until date (for quotes) */
  valid_until?: string;

  [key: string]: unknown;
}

interface DuplicateCustomer {
  id: string;
  customer_number: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  match_reason: string;
}

interface UseFormAutoFillReturn {
  /** Suggested values for form fields */
  suggestions: AutoFillSuggestions | null;

  /** Confidence scores (0-1) for each suggestion */
  confidence: Record<string, number>;

  /** Data source for each suggestion */
  source: Record<string, string>;

  /** Potential duplicate customers (for customer forms) */
  duplicates: DuplicateCustomer[];

  /** Additional message */
  message: string | null;

  /** Loading state */
  loading: boolean;

  /** Error message */
  error: string | null;

  /** Fetch suggestions based on current options */
  fetchSuggestions: () => Promise<void>;

  /** Clear suggestions */
  clear: () => void;
}

export function useFormAutoFill(options: FormAutoFillOptions): UseFormAutoFillReturn {
  const [suggestions, setSuggestions] = useState<AutoFillSuggestions | null>(null);
  const [confidence, setConfidence] = useState<Record<string, number>>({});
  const [source, setSource] = useState<Record<string, string>>({});
  const [duplicates, setDuplicates] = useState<DuplicateCustomer[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post<{
        suggestions: AutoFillSuggestions;
        confidence: Record<string, number>;
        source: Record<string, string>;
        duplicates: DuplicateCustomer[];
        message?: string | null;
      }>('/api/ai/form-autofill', {
        form_type: options.formType,
        customer_id: options.customerId,
        supplier_id: options.supplierId,
        email: options.email,
        name: options.name,
        phone: options.phone,
        limit: options.limit || 10,
      });

      setSuggestions(response.suggestions || {});
      setConfidence(response.confidence || {});
      setSource(response.source || {});
      setDuplicates(response.duplicates || []);
      setMessage(response.message || null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch auto-fill suggestions');
      setSuggestions(null);
      setConfidence({});
      setSource({});
      setDuplicates([]);
    } finally {
      setLoading(false);
    }
  }, [
    options.formType,
    options.customerId,
    options.supplierId,
    options.email,
    options.name,
    options.phone,
    options.limit,
  ]);

  const clear = useCallback(() => {
    setSuggestions(null);
    setConfidence({});
    setSource({});
    setDuplicates([]);
    setMessage(null);
    setError(null);
  }, []);

  return {
    suggestions,
    confidence,
    source,
    duplicates,
    message,
    loading,
    error,
    fetchSuggestions,
    clear,
  };
}
