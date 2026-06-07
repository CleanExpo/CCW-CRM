import { apiClient } from '@/lib/api/client';

export type TradeFinanceAdvanceRow = {
  id: string;
  advance_number: string;
  supplier: string | null;
  shipment: string | null;
  drawn: number;
  due: string;
  balance: number;
  status: string;
};

export type TradeFinanceFacilityRow = {
  id: string;
  provider: string;
  name: string;
  facility_limit: number;
  currency: string;
  status: string;
  drawn_total: number;
  available: number;
  advances: TradeFinanceAdvanceRow[];
};

export async function listTradeFinanceFacilities(): Promise<TradeFinanceFacilityRow[]> {
  return apiClient.get('/api/trade-finance/facilities');
}

export async function createTradeFinanceFacility(input: {
  name: string;
  facility_limit: number;
  provider?: string;
  currency?: string;
}) {
  return apiClient.post('/api/trade-finance/facilities', input);
}

export async function createTradeFinanceAdvance(input: {
  facility_id: string;
  advance_number: string;
  drawdown_date: string;
  maturity_date: string;
  principal_amount: number;
  supplier_id?: string;
  purchase_order_id?: string;
  fees?: number;
  interest?: number;
  security_ref?: string;
}) {
  return apiClient.post('/api/trade-finance/advances', input);
}
