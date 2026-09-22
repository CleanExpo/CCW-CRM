import { apiClient } from '@/lib/api/client';

export type PresentedPrice = {
  price: number;
  currency: string;
  captured_at: string;
  age_days: number;
  stale: boolean;
  source: string;
};

export type CompetitorRow = {
  id: string;
  competitor: string;
  url: string;
  title: string | null;
  competitor_sku: string | null;
  match_status: 'suggested' | 'confirmed' | 'rejected';
  is_active: boolean;
  last_attempt_at: string | null;
  last_error: string | null;
  product: { id: string; name: string; sku: string; price: number } | null;
  latest_price: PresentedPrice | null;
  history: PresentedPrice[];
};

export type ComparisonItem = {
  product: { id: string; name: string; sku: string; price: number };
  unit_cost: number | null;
  ccw_margin: number | null;
  competitors: {
    id: string;
    competitor: string;
    url: string;
    title: string | null;
    latest_price: PresentedPrice | null;
    last_error: string | null;
    margin_at_match: number | null;
  }[];
};

export type CaptureResult = {
  run: {
    id: string;
    page_budget: number;
    attempted: number;
    succeeded: number;
    failed: number;
    skipped: number;
    stopped_reason: string | null;
  };
  outcomes: {
    id: string;
    url: string;
    ok: boolean;
    price?: number;
    error?: string;
    skipped?: string;
  }[];
};

export const priceMoleApi = {
  list: () => apiClient.get<{ items: CompetitorRow[] }>('/api/price-mole/competitors'),
  create: (data: {
    competitor: string;
    url: string;
    product_sku?: string;
    competitor_sku?: string;
  }) => apiClient.post<{ id: string }>('/api/price-mole/competitors', data),
  review: (id: string, status: string) =>
    apiClient.patch<{ id: string }>(`/api/price-mole/competitors/${id}`, { status }),
  manualPrice: (id: string, price: number) =>
    apiClient.post<{ id: string }>(`/api/price-mole/competitors/${id}/price`, { price }),
  capture: (data: { page_budget?: number; competitor_product_id?: string }) =>
    apiClient.post<CaptureResult>('/api/price-mole/capture', data),
  compare: (productIds: string[]) =>
    apiClient.get<{ items: ComparisonItem[] }>(
      `/api/price-mole/quote-comparison?product_ids=${productIds.map(encodeURIComponent).join(',')}`
    ),
};
