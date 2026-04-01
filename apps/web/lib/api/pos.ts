/**
 * POS System API Client
 * Centralized API methods for POS operations
 */

import { apiClient } from "./client";
import type {
  Location,
  SalesStaff,
  POSTerminal,
  POSTransaction,
  CreateTransactionRequest,
} from "@/app/(dashboard)/pos/types";

// ─── Additional Types ──────────────────────────────────────────────

export interface BankAccount {
  id: string;
  account_name: string;
  account_number: string;
  bsb: string;
  bank_name: string;
  account_type: "checking" | "savings" | "credit";
  feed_provider: "xero" | "yodlee" | "basiq" | "manual";
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BankFeed {
  id: string;
  bank_account_id: string;
  transaction_date: string;
  description: string;
  amount: number;
  balance: number;
  reference: string | null;
  is_reconciled: boolean;
  pos_transaction_id: string | null;
  created_at: string;
}

export interface ReconciliationAlert {
  id: string;
  alert_type: string;
  severity: "info" | "warning" | "critical";
  message: string;
  bank_feed_id: string | null;
  pos_transaction_id: string | null;
  created_at: string;
}

export interface ReconciliationFilters {
  bank_account_id?: string;
  start_date?: string;
  end_date?: string;
  status?: "all" | "matched" | "unmatched" | "discrepancy";
  min_amount?: number;
  max_amount?: number;
}

export interface ReconcileMatch {
  bank_feed_id: string;
  pos_transaction_id: string;
}

export interface BulkReconcileResult {
  success: boolean;
  matched_count: number;
  failed_count: number;
  errors: string[];
}

export interface TerminalCreateData {
  terminal_code: string;
  location_id: string;
  terminal_type: "physical" | "virtual";
  provider?: string;
  serial_number?: string;
  is_active: boolean;
}

export interface TerminalUpdateData {
  location_id?: string;
  terminal_type?: "physical" | "virtual";
  provider?: string;
  serial_number?: string;
  is_active?: boolean;
}

export interface BankAccountCreateData {
  account_name: string;
  account_number: string;
  bsb: string;
  bank_name: string;
  account_type: "checking" | "savings" | "credit";
  feed_provider: "xero" | "yodlee" | "basiq" | "manual";
  is_active: boolean;
}

export interface BankAccountUpdateData {
  account_name?: string;
  account_number?: string;
  bsb?: string;
  bank_name?: string;
  account_type?: "checking" | "savings" | "credit";
  feed_provider?: "xero" | "yodlee" | "basiq" | "manual";
  is_active?: boolean;
}

// ─── Locations ─────────────────────────────────────────────────────

export async function getLocations(): Promise<Location[]> {
  return apiClient.get<Location[]>("/api/pos/locations");
}

export async function createLocation(data: Partial<Location>): Promise<Location> {
  return apiClient.post<Location>("/api/pos/locations", data);
}

export async function updateLocation(id: string, data: Partial<Location>): Promise<Location> {
  return apiClient.put<Location>(`/api/pos/locations/${id}`, data);
}

export async function deleteLocation(id: string): Promise<void> {
  return apiClient.delete(`/api/pos/locations/${id}`);
}

// ─── Sales Staff ───────────────────────────────────────────────────

export async function getStaff(): Promise<SalesStaff[]> {
  return apiClient.get<SalesStaff[]>("/api/pos/staff");
}

export async function createStaff(data: Partial<SalesStaff>): Promise<SalesStaff> {
  return apiClient.post<SalesStaff>("/api/pos/staff", data);
}

export async function updateStaff(id: string, data: Partial<SalesStaff>): Promise<SalesStaff> {
  return apiClient.put<SalesStaff>(`/api/pos/staff/${id}`, data);
}

export async function deleteStaff(id: string): Promise<void> {
  return apiClient.delete(`/api/pos/staff/${id}`);
}

// ─── Terminals ─────────────────────────────────────────────────────

export async function getTerminals(locationId?: string): Promise<POSTerminal[]> {
  const url = locationId
    ? `/api/pos/terminals?location_id=${locationId}`
    : "/api/pos/terminals";
  return apiClient.get<POSTerminal[]>(url);
}

export async function createTerminal(data: TerminalCreateData): Promise<POSTerminal> {
  return apiClient.post<POSTerminal>("/api/pos/terminals", data);
}

export async function updateTerminal(
  id: string,
  data: TerminalUpdateData
): Promise<POSTerminal> {
  return apiClient.put<POSTerminal>(`/api/pos/terminals/${id}`, data);
}

export async function deleteTerminal(id: string): Promise<void> {
  return apiClient.delete(`/api/pos/terminals/${id}`);
}

// ─── Transactions ──────────────────────────────────────────────────

export async function getTransactions(filters?: {
  location_code?: string;
  start_date?: string;
  end_date?: string;
}): Promise<POSTransaction[]> {
  const params = new URLSearchParams();
  if (filters?.location_code) params.set("location_code", filters.location_code);
  if (filters?.start_date) params.set("start_date", filters.start_date);
  if (filters?.end_date) params.set("end_date", filters.end_date);

  const url = `/api/pos/transactions${params.toString() ? `?${params.toString()}` : ""}`;
  return apiClient.get<POSTransaction[]>(url);
}

export async function getTransaction(id: string): Promise<POSTransaction> {
  return apiClient.get<POSTransaction>(`/api/pos/transactions/${id}`);
}

export async function createTransaction(
  data: CreateTransactionRequest
): Promise<POSTransaction> {
  return apiClient.post<POSTransaction>("/api/pos/transactions", data);
}

// ─── Bank Accounts ─────────────────────────────────────────────────

export async function getBankAccounts(): Promise<BankAccount[]> {
  return apiClient.get<BankAccount[]>("/api/bank-feeds/accounts");
}

export async function createBankAccount(
  data: BankAccountCreateData
): Promise<BankAccount> {
  return apiClient.post<BankAccount>("/api/bank-feeds/accounts", data);
}

export async function updateBankAccount(
  id: string,
  data: BankAccountUpdateData
): Promise<BankAccount> {
  return apiClient.put<BankAccount>(`/api/bank-feeds/accounts/${id}`, data);
}

export async function deleteBankAccount(id: string): Promise<void> {
  return apiClient.delete(`/api/bank-feeds/accounts/${id}`);
}

// ─── Bank Feeds & Reconciliation ───────────────────────────────────

export async function getUnreconciledFeeds(
  accountId?: string,
  filters?: ReconciliationFilters
): Promise<BankFeed[]> {
  const params = new URLSearchParams();
  if (accountId) params.set("account_id", accountId);
  if (filters?.start_date) params.set("start_date", filters.start_date);
  if (filters?.end_date) params.set("end_date", filters.end_date);
  if (filters?.min_amount) params.set("min_amount", filters.min_amount.toString());
  if (filters?.max_amount) params.set("max_amount", filters.max_amount.toString());

  const url = `/api/bank-feeds/unreconciled${params.toString() ? `?${params.toString()}` : ""}`;
  return apiClient.get<BankFeed[]>(url);
}

export async function getReconciliationAlerts(accountId?: string): Promise<ReconciliationAlert[]> {
  const url = accountId
    ? `/api/bank-feeds/alerts?account_id=${accountId}`
    : "/api/bank-feeds/alerts";
  return apiClient.get<ReconciliationAlert[]>(url);
}

export async function syncBankFeeds(accountId: string): Promise<{ synced_count: number }> {
  return apiClient.post<{ synced_count: number }>("/api/bank-feeds/sync", {
    account_id: accountId,
  });
}

export async function reconcileTransaction(
  bankFeedId: string,
  posTransactionId: string
): Promise<{ success: boolean }> {
  return apiClient.post<{ success: boolean }>("/api/bank-feeds/reconcile", {
    bank_feed_id: bankFeedId,
    pos_transaction_id: posTransactionId,
  });
}

export async function bulkReconcile(matches: ReconcileMatch[]): Promise<BulkReconcileResult> {
  return apiClient.post<BulkReconcileResult>("/api/bank-feeds/bulk-reconcile", {
    matches,
  });
}

export async function exportReconciliationData(
  filters: ReconciliationFilters
): Promise<Blob> {
  const params = new URLSearchParams();
  if (filters.bank_account_id) params.set("account_id", filters.bank_account_id);
  if (filters.start_date) params.set("start_date", filters.start_date);
  if (filters.end_date) params.set("end_date", filters.end_date);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);

  const url = `/api/bank-feeds/export${params.toString() ? `?${params.toString()}` : ""}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to export reconciliation data");
  }

  return response.blob();
}

// ─── Xero Integration ──────────────────────────────────────────────

export async function createBulkXeroInvoices(transactionIds: string[]): Promise<{
  success: boolean;
  created_count: number;
  failed_count: number;
  errors: string[];
}> {
  return apiClient.post("/api/pos/xero/bulk-invoices", {
    transaction_ids: transactionIds,
  });
}
