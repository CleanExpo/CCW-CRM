/**
 * AI Insights API client
 */

import { apiClient } from "./client";

export interface DateRange {
  start_date?: string;
  end_date?: string;
}

export interface GenerateInsightsRequest {
  category: "sales" | "inventory" | "customers" | "orders" | "all";
  date_range?: DateRange;
  filters?: Record<string, any>;
  user_id?: string;
}

export interface Insight {
  id: string;
  title: string;
  finding: string;
  impact: string;
  recommendation: string;
  priority: "high" | "medium" | "low";
  category: string;
  generated_at: string;
}

export interface GenerateInsightsResponse {
  category: string;
  insights: Insight[];
  priority_insights: Insight[];
  total_insights: number;
  tools_used: string[];
  summary: Record<string, any>;
  metadata: Record<string, any>;
}

export interface DashboardInsightsResponse {
  insights: Insight[];
  total: number;
  categories: string[];
}

export interface InsightHistoryResponse {
  insights: Insight[];
  total: number;
  page: number;
  page_size: number;
}

/**
 * Generate AI-powered business insights
 */
export async function generateInsights(
  request: GenerateInsightsRequest
): Promise<GenerateInsightsResponse> {
  return apiClient.post<GenerateInsightsResponse>(
    "/api/ai/insights/generate",
    request
  );
}

/**
 * Get recent insights for dashboard display
 */
export async function getDashboardInsights(
  limit: number = 10
): Promise<DashboardInsightsResponse> {
  return apiClient.get<DashboardInsightsResponse>(
    `/api/ai/insights/dashboard?limit=${limit}`
  );
}

/**
 * Get historical insights with filtering
 */
export async function getInsightHistory(
  category?: string,
  priority?: string,
  page: number = 1,
  page_size: number = 20
): Promise<InsightHistoryResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    page_size: page_size.toString(),
  });

  if (category) params.append("category", category);
  if (priority) params.append("priority", priority);

  return apiClient.get<InsightHistoryResponse>(
    `/api/ai/insights/history?${params.toString()}`
  );
}
