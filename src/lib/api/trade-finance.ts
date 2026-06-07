import { apiClient } from '@/lib/api/client';

export type TradeFinanceAdvanceRow = {
  id: string;
  advance_number: string;
  supplier: string | null;
  shipment: string | null;
  lc_number?: string | null;
  drawn: number;
  repaid?: number;
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

export type TradeFinanceLcRow = {
  id: string;
  lc_number: string;
  bank_ref: string | null;
  amount: number;
  currency: string;
  lc_type: string;
  issue_date: string;
  expiry_date: string;
  status: string;
  notes: string | null;
  beneficiary: string | null;
  purchase_order: string | null;
  facility: string | null;
  document_count: number;
  advance_count: number;
};

export type TradeFinanceSummary = {
  facility_count: number;
  total_limit: number;
  total_outstanding: number;
  total_available: number;
  open_advances: number;
  advances_overdue: number;
  advances_maturing_14d: number;
  active_letters_of_credit: number;
};

export async function listTradeFinanceFacilities(): Promise<TradeFinanceFacilityRow[]> {
  return apiClient.get('/api/trade-finance/facilities');
}

export async function getTradeFinanceSummary(): Promise<TradeFinanceSummary> {
  return apiClient.get('/api/trade-finance/summary');
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
  lc_id?: string;
  fees?: number;
  interest?: number;
  security_ref?: string;
}) {
  return apiClient.post('/api/trade-finance/advances', input);
}

export async function recordAdvanceRepayment(
  advanceId: string,
  input: { amount: number; payment_date?: string; reference?: string; notes?: string }
) {
  return apiClient.post(`/api/trade-finance/advances/${advanceId}/repayments`, input);
}

export async function listLettersOfCredit(status?: string): Promise<TradeFinanceLcRow[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiClient.get(`/api/trade-finance/letters-of-credit${qs}`);
}

export async function createLetterOfCredit(input: {
  lc_number: string;
  facility_id?: string;
  bank_ref?: string;
  beneficiary_supplier_id?: string;
  purchase_order_id?: string;
  amount: number;
  currency?: string;
  lc_type?: string;
  issue_date: string;
  expiry_date: string;
  notes?: string;
}) {
  return apiClient.post('/api/trade-finance/letters-of-credit', input);
}

export async function updateLetterOfCredit(id: string, input: { status?: string; notes?: string }) {
  return apiClient.patch(`/api/trade-finance/letters-of-credit/${id}`, input);
}
