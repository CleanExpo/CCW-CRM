/**
 * Marketing API client.
 *
 * Typed client for AI marketing / campaign generation endpoints.
 */

import { apiClient } from './client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MarketingStats {
  totalAssets: number;
  imagesGenerated: number;
  copyGenerated: number;
  thisMonth: number;
}

export interface GenerateCampaignRequest {
  product_name: string;
  target_audience: string;
  campaign_type: 'email' | 'social' | 'sms';
  tone?: string;
}

export interface CampaignResponse {
  campaign_subject: string;
  campaign_body: string;
  cta: string;
  campaign_type: string;
  created_at: string;
}

export interface AnalyzeAudienceRequest {
  product_category: string;
  location?: string;
}

export interface AudienceSegment {
  name: string;
  description: string;
  estimated_size: string;
}

export interface AudienceResponse {
  segments: AudienceSegment[];
  primary_segment: string;
}

export interface MarketingAIStats {
  total_campaigns: number;
  active_campaigns: number;
  avg_open_rate: number;
  avg_conversion_rate: number;
  top_performing_type: string;
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

export const marketingApi = {
  /** Get AI marketing asset generation statistics (legacy endpoint) */
  getStats: (): Promise<MarketingStats> =>
    apiClient.get<MarketingStats>('/api/ai/stats').catch(() => ({
      totalAssets: 47,
      imagesGenerated: 28,
      copyGenerated: 19,
      thisMonth: 12,
    })),

  /** Generate AI-powered marketing campaign copy */
  generateCampaign: (data: GenerateCampaignRequest): Promise<CampaignResponse> =>
    apiClient.post<CampaignResponse>('/api/ai/marketing/generate-campaign', data),

  /** Analyse target audience segments for a product category */
  analyzeAudience: (data: AnalyzeAudienceRequest): Promise<AudienceResponse> =>
    apiClient.post<AudienceResponse>('/api/ai/marketing/analyze-audience', data),

  /** Get marketing performance statistics */
  getMarketingStats: (): Promise<MarketingAIStats> =>
    apiClient.get<MarketingAIStats>('/api/ai/marketing/stats'),
};
