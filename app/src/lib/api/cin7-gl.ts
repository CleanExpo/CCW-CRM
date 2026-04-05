/**
 * Cin7 Financial / GL Integration API client.
 *
 * Typed functions for Chart of Accounts sync, journal entry management,
 * and ERP-to-GL account mapping.
 */

import { apiClient } from './client';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export type AccountType =
  | 'asset'
  | 'liability'
  | 'equity'
  | 'revenue'
  | 'expense'
  | 'cost_of_goods';

export type JournalStatus = 'draft' | 'posted' | 'void';

export type JournalSource = 'manual' | 'order' | 'invoice' | 'payment' | 'adjustment';

export type LineType = 'debit' | 'credit';

export type ErpEntityType = 'order' | 'invoice' | 'payment' | 'refund' | 'adjustment';

export interface Cin7ChartOfAccount {
  id: string;
  cin7_account_id: string;
  account_code: string;
  account_name: string;
  account_type: AccountType;
  parent_account_id: string | null;
  is_active: boolean;
  currency: string;
  description: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChartOfAccountsListResponse {
  accounts: Cin7ChartOfAccount[];
  total: number;
}

export interface SyncChartOfAccountsResponse {
  synced: number;
  created: number;
  updated: number;
  message: string;
}

export interface Cin7JournalLine {
  id: string;
  journal_entry_id: string;
  account_id: string;
  account_code: string | null;
  account_name: string | null;
  line_type: LineType;
  amount: string;
  description: string | null;
  order_id: string | null;
  tax_amount: string;
}

export interface Cin7JournalEntry {
  id: string;
  cin7_journal_id: string | null;
  journal_date: string;
  reference: string | null;
  description: string | null;
  status: JournalStatus;
  total_debit: string;
  total_credit: string;
  currency: string;
  source: JournalSource;
  cin7_synced: boolean;
  created_at: string;
  updated_at: string;
  lines: Cin7JournalLine[];
}

export interface JournalEntriesListResponse {
  entries: Cin7JournalEntry[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface JournalLineCreateRequest {
  account_id: string;
  line_type: LineType;
  amount: number;
  description?: string;
  tax_amount?: number;
}

export interface JournalEntryCreateRequest {
  journal_date: string;
  reference?: string;
  description?: string;
  currency?: string;
  lines: JournalLineCreateRequest[];
}

export interface Cin7AccountMapping {
  id: string;
  erp_entity_type: ErpEntityType;
  erp_field: string;
  cin7_account_id: string | null;
  account_code: string | null;
  account_name: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface AccountMappingsListResponse {
  mappings: Cin7AccountMapping[];
  total: number;
}

export interface UpsertAccountMappingRequest {
  erp_entity_type: ErpEntityType;
  erp_field: string;
  account_code?: string;
  cin7_account_id?: string;
  is_default?: boolean;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/** List all Chart of Accounts, optionally filtered by account_type / is_active */
export function listAccounts(
  accountType?: AccountType,
  isActive?: boolean
): Promise<ChartOfAccountsListResponse> {
  const params = new URLSearchParams();
  if (accountType) params.append('account_type', accountType);
  if (isActive !== undefined) params.append('is_active', String(isActive));
  const qs = params.toString();
  return apiClient.get<ChartOfAccountsListResponse>(
    `/api/cin7/chart-of-accounts${qs ? `?${qs}` : ''}`
  );
}

/** Trigger a Chart of Accounts sync from Cin7 */
export function syncChartOfAccounts(): Promise<SyncChartOfAccountsResponse> {
  return apiClient.post<SyncChartOfAccountsResponse>('/api/cin7/chart-of-accounts/sync');
}

/** List journal entries with optional pagination, status and date filters */
export function listJournalEntries(
  page: number = 1,
  pageSize: number = 20,
  status?: JournalStatus,
  dateFrom?: string,
  dateTo?: string
): Promise<JournalEntriesListResponse> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (status) params.append('status', status);
  if (dateFrom) params.append('date_from', dateFrom);
  if (dateTo) params.append('date_to', dateTo);
  return apiClient.get<JournalEntriesListResponse>(
    `/api/cin7/journal-entries?${params.toString()}`
  );
}

/** Create a new manual journal entry (returned as draft) */
export function createJournalEntry(data: JournalEntryCreateRequest): Promise<Cin7JournalEntry> {
  return apiClient.post<Cin7JournalEntry>('/api/cin7/journal-entries', data);
}

/** Post a draft journal entry (validates debit == credit) */
export function postJournalEntry(id: string): Promise<Cin7JournalEntry> {
  return apiClient.patch<Cin7JournalEntry>(`/api/cin7/journal-entries/${id}/post`);
}

/** List all ERP-to-GL account mappings */
export function listAccountMappings(): Promise<AccountMappingsListResponse> {
  return apiClient.get<AccountMappingsListResponse>('/api/cin7/account-mappings');
}

/** Create or update an ERP-to-GL account mapping */
export function upsertAccountMapping(
  data: UpsertAccountMappingRequest
): Promise<Cin7AccountMapping> {
  return apiClient.put<Cin7AccountMapping>('/api/cin7/account-mappings', data);
}
