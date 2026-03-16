'use client';

/**
 * PHASE AI: Auto-Fill Suggestion Component
 *
 * Displays AI-generated form suggestions with confidence scores
 * and one-click apply functionality.
 */

import { Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface AutoFillSuggestionProps {
  /** Field name being suggested */
  fieldName: string;

  /** Suggested value */
  suggestion: unknown;

  /** Confidence score (0-1) */
  confidence: number;

  /** Data source description */
  source?: string;

  /** Callback when user applies suggestion */
  onApply: (value: unknown) => void;

  /** Callback when user dismisses suggestion */
  onDismiss?: () => void;

  /** Custom display formatter */
  formatValue?: (value: unknown) => string;
}

export function AutoFillSuggestion({
  fieldName,
  suggestion,
  confidence,
  source,
  onApply,
  onDismiss,
  formatValue,
}: AutoFillSuggestionProps) {
  const confidencePercent = Math.round(confidence * 100);

  // Default formatter
  const displayValue = formatValue
    ? formatValue(suggestion)
    : typeof suggestion === 'object'
      ? JSON.stringify(suggestion, null, 2)
      : String(suggestion);

  // Confidence color
  const confidenceColor =
    confidence >= 0.9
      ? 'bg-green-500/10 text-green-700 border-green-500/20'
      : confidence >= 0.7
        ? 'bg-blue-500/10 text-blue-700 border-blue-500/20'
        : 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20';

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />

          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-sm font-medium text-blue-900">AI suggests for {fieldName}</span>
              <Badge variant="outline" className={confidenceColor}>
                {confidencePercent}% confident
              </Badge>
            </div>

            <div className="mb-2 line-clamp-2 text-sm text-blue-800">{displayValue}</div>

            {source && (
              <div className="mb-2 text-xs text-blue-600">Source: {source.replace(/_/g, ' ')}</div>
            )}

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => onApply(suggestion)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Apply
              </Button>
              {onDismiss && (
                <Button size="sm" variant="outline" onClick={onDismiss}>
                  Dismiss
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Product Suggestion Component
 *
 * Specialized display for product auto-fill suggestions.
 */
interface ProductSuggestion {
  product_id: string;
  sku: string;
  name: string;
  price: number;
  avg_quantity: number;
  count: number;
}

interface ProductAutoFillSuggestionProps {
  products: ProductSuggestion[];
  confidence: number;
  source?: string;
  onApplyProduct: (product: ProductSuggestion) => void;
  onApplyAll: () => void;
  onDismiss?: () => void;
}

export function ProductAutoFillSuggestion({
  products,
  confidence,
  source,
  onApplyProduct,
  onApplyAll,
  onDismiss,
}: ProductAutoFillSuggestionProps) {
  const confidencePercent = Math.round(confidence * 100);

  if (!products || products.length === 0) {
    return null;
  }

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />

          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-blue-900">
                  AI suggests {products.length} products
                </span>
                <Badge
                  variant="outline"
                  className="border-blue-500/20 bg-blue-500/10 text-blue-700"
                >
                  {confidencePercent}% confident
                </Badge>
              </div>
              {onDismiss && (
                <Button size="sm" variant="ghost" onClick={onDismiss} className="h-6 px-2">
                  Dismiss
                </Button>
              )}
            </div>

            {source && (
              <div className="mb-2 text-xs text-blue-600">Based on {source.replace(/_/g, ' ')}</div>
            )}

            <div className="mb-3 max-h-48 space-y-1.5 overflow-y-auto">
              {products.map((product) => (
                <div
                  key={product.product_id}
                  className="flex items-center justify-between rounded border border-blue-100 bg-white p-2 transition-colors hover:border-blue-300"
                >
                  <div className="mr-2 min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-gray-900">{product.name}</div>
                    <div className="text-xs text-gray-500">
                      {product.sku} • ${product.price.toFixed(2)} • Avg qty: {product.avg_quantity}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onApplyProduct(product)}
                    className="flex-shrink-0"
                  >
                    Add
                  </Button>
                </div>
              ))}
            </div>

            <Button size="sm" onClick={onApplyAll} className="w-full bg-blue-600 hover:bg-blue-700">
              Add All {products.length} Products
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Duplicate Customer Warning Component
 */
interface DuplicateCustomer {
  id: string;
  customer_number: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  match_reason: string;
}

interface DuplicateCustomerWarningProps {
  duplicates: DuplicateCustomer[];
  onSelectExisting: (customer: DuplicateCustomer) => void;
  onContinueAnyway: () => void;
}

export function DuplicateCustomerWarning({
  duplicates,
  onSelectExisting,
  onContinueAnyway,
}: DuplicateCustomerWarningProps) {
  if (!duplicates || duplicates.length === 0) {
    return null;
  }

  return (
    <Card className="border-yellow-300 bg-yellow-50/50">
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600" />

          <div className="min-w-0 flex-1">
            <div className="mb-2 text-sm font-medium text-yellow-900">
              ⚠️ Potential duplicate customer{duplicates.length > 1 ? 's' : ''} found
            </div>

            <div className="mb-3 space-y-1.5">
              {duplicates.map((customer) => (
                <div
                  key={customer.id}
                  className="rounded border border-yellow-200 bg-white p-2 transition-colors hover:border-yellow-400"
                >
                  <div className="text-sm font-medium text-gray-900">
                    {customer.company_name || customer.contact_name}
                  </div>
                  <div className="text-xs text-gray-600">
                    {customer.customer_number} • {customer.email}
                  </div>
                  <div className="mt-1 text-xs text-yellow-700">
                    Matches on: {customer.match_reason}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onSelectExisting(customer)}
                    className="mt-2 w-full"
                  >
                    Use Existing Customer
                  </Button>
                </div>
              ))}
            </div>

            <Button size="sm" variant="outline" onClick={onContinueAnyway} className="w-full">
              Continue with New Customer Anyway
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
