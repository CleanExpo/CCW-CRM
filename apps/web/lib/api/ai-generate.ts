/**
 * AI Content Generation API client
 */

import { apiClient } from "./client";

export interface GenerateQuoteRequest {
  requirements: string;
  customer_id?: string;
  user_id?: string;
}

export interface QuoteItem {
  product_id: string;
  sku: string;
  name: string;
  description?: string;
  category: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  stock_available: number;
}

export interface GenerateQuoteResponse {
  quote_number: string;
  customer_id?: string;
  customer: {
    id?: string;
    company_name?: string;
    contact_name?: string;
    email?: string;
  };
  items: QuoteItem[];
  subtotal: number;
  tax: number;
  tax_rate: number;
  total: number;
  currency: string;
  notes: string;
  special_requirements: string;
  valid_until: string;
  quote_date: string;
  description?: string;
  requires_review: boolean;
  validation_errors: string[];
}

export interface GenerateEmailRequest {
  email_type: "quote_follow_up" | "order_confirmation" | "custom";
  context: {
    quote_id?: string;
    order_id?: string;
    customer_id?: string;
    purpose?: string;
  };
  requirements?: string;
  tone?: "formal" | "friendly" | "urgent";
  user_id?: string;
}

export interface GenerateEmailResponse {
  subject: string;
  body: string;
  to: string;
  customer_name: string;
  company_name: string;
  requires_review: boolean;
  validation_errors: string[];
}

/**
 * Generate a quote from natural language requirements
 */
export async function generateQuote(
  request: GenerateQuoteRequest
): Promise<GenerateQuoteResponse> {
  return apiClient.post<GenerateQuoteResponse>(
    "/api/ai/generate/quote",
    request
  );
}

/**
 * Generate an email for customer communication
 */
export async function generateEmail(
  request: GenerateEmailRequest
): Promise<GenerateEmailResponse> {
  return apiClient.post<GenerateEmailResponse>(
    "/api/ai/generate/email",
    request
  );
}

/**
 * Generate a summary or report
 */
export async function generateSummary(
  requirements: string,
  summaryType: string = "general",
  userId?: string
): Promise<any> {
  return apiClient.post("/api/ai/generate/summary", {
    requirements,
    summary_type: summaryType,
    user_id: userId,
  });
}
