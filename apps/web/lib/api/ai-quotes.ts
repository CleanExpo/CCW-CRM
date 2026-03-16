/**
 * AI Quotes API Client
 *
 * Client methods for AI-powered quote generation endpoints.
 */

import { apiClient } from "./client";

// Types

export interface ProductMatch {
  product_id: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  unit_price: string;
  line_total: string;
  confidence: number;
  alternatives?: Array<{
    product_id: string;
    sku: string;
    name: string;
    price: string;
  }>;
}

export interface CustomerMatch {
  customer_id: string | null;
  customer_number: string | null;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  confidence: number;
  is_new_customer: boolean;
}

export interface QuoteGenerationResult {
  customer: CustomerMatch;
  line_items: ProductMatch[];
  notes: string | null;
  discount_percentage: number;
  subtotal: string;
  discount_amount: string;
  total: string;
  valid_until: string;
  confidence_score: number;
  warnings: string[];
  suggestions: string[];
}

export interface GenerateQuoteRequest {
  prompt: string;
  user_context?: Record<string, any>;
}

export interface GenerateQuoteResponse {
  success: boolean;
  data: QuoteGenerationResult | null;
  error: string | null;
}

export interface ParsePromptResponse {
  success: boolean;
  data: {
    customer: CustomerMatch;
    line_items: ProductMatch[];
    total: string;
    confidence: number;
    warnings: string[];
  } | null;
  error: string | null;
}

export interface ProductSuggestion {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: string;
  stock: number;
}

export interface CustomerSuggestion {
  id: string;
  customer_number: string;
  company_name: string;
  contact_name: string;
  email: string;
}

// API Methods

/**
 * Generate a quote from natural language prompt.
 *
 * @param prompt - Natural language description of the quote
 * @param userContext - Optional context (user_id, organization_id, etc.)
 * @returns Generated quote data with confidence scores
 *
 * @example
 * const result = await generateQuote("Create a quote for John Smith with 5 power drills and 10 safety helmets");
 */
export async function generateQuote(
  prompt: string,
  userContext?: Record<string, any>
): Promise<QuoteGenerationResult> {
  const response = await apiClient.post<GenerateQuoteResponse>(
    "/api/ai/quotes/generate",
    {
      prompt,
      user_context: userContext,
    }
  );

  if (!response.success || !response.data) {
    throw new Error(response.error || "Quote generation failed");
  }

  return response.data;
}

/**
 * Parse prompt without saving (preview mode).
 *
 * Use this for real-time preview as the user types.
 *
 * @param prompt - Natural language to parse
 * @returns Simplified preview data
 *
 * @example
 * const preview = await parsePromptPreview("5 drills for ABC Corp");
 */
export async function parsePromptPreview(prompt: string): Promise<ParsePromptResponse> {
  return apiClient.post<ParsePromptResponse>("/api/ai/quotes/parse-prompt", {
    prompt,
  });
}

/**
 * Get product suggestions for autocomplete.
 *
 * @param query - Partial query string
 * @param limit - Maximum results (default: 5)
 * @returns Array of matching products
 *
 * @example
 * const products = await suggestProducts("drill", 5);
 */
export async function suggestProducts(
  query: string,
  limit: number = 5
): Promise<ProductSuggestion[]> {
  const response = await apiClient.post<{ success: boolean; data: ProductSuggestion[] }>(
    "/api/ai/quotes/suggest-products",
    { query, limit }
  );

  return response.success ? response.data : [];
}

/**
 * Get customer suggestions for autocomplete.
 *
 * @param query - Partial query string
 * @param limit - Maximum results (default: 5)
 * @returns Array of matching customers
 *
 * @example
 * const customers = await suggestCustomers("Smith", 5);
 */
export async function suggestCustomers(
  query: string,
  limit: number = 5
): Promise<CustomerSuggestion[]> {
  const response = await apiClient.post<{ success: boolean; data: CustomerSuggestion[] }>(
    "/api/ai/quotes/suggest-customers",
    { query, limit }
  );

  return response.success ? response.data : [];
}

/**
 * Check AI quotes service health.
 *
 * @returns Health status including API key configuration
 */
export async function checkAIQuotesHealth(): Promise<{
  status: string;
  service: string;
  model: string;
  api_key_configured: boolean;
  caching_enabled: boolean;
}> {
  return apiClient.get("/api/ai/quotes/health");
}
