/**
 * Reconciliation TypeScript Types
 * DTO shapes for POS / Xero reconciliation API responses.
 */

export enum ReconciliationStatus {
  UNMATCHED = 'unmatched',
  MATCHED = 'matched',
  RECONCILED = 'reconciled',
  DISPUTED = 'disputed',
}

export interface ReconciliationMatch {
  pos_transaction_id: string;
  pos_transaction_number: string;
  pos_amount: number;
  pos_payment_method: string;
  pos_transaction_date: string;
  bank_feed_id?: string;
  bank_amount?: number;
  bank_transaction_date?: string;
  bank_description?: string;
  xero_invoice_id?: string;
  xero_invoice_number?: string;
  xero_payment_id?: string;
  reconciliation_status: ReconciliationStatus;
  amount_difference?: number;
  matched_at?: string;
  reconciled_at?: string;
}

export interface CreateInvoiceRequest {
  pos_transaction_id: string;
  organization_id: string;
}

export interface CreateInvoiceResponse {
  success: boolean;
  pos_transaction_id: string;
  transaction_number: string;
  xero_invoice_id: string;
  xero_invoice_number: string;
  total: number;
  already_exists: boolean;
}

export interface ReconcileRequest {
  pos_transaction_id: string;
  bank_feed_id: string;
  organization_id: string;
}

export interface ReconcileResponse {
  success: boolean;
  pos_transaction_id: string;
  bank_feed_id: string;
  xero_payment_id: string;
  amount: number;
  reconciliation_status: string;
}

export interface AutoReconcileRequest {
  organization_id: string;
  days_back?: number;
}

export interface AutoReconcileResponse {
  success: boolean;
  matches_found: number;
  invoices_created: number;
  payments_reconciled: number;
  errors: string[];
}

export interface ReconciliationSummary {
  total_pos_transactions: number;
  total_bank_feeds: number;
  matched_count: number;
  reconciled_count: number;
  unmatched_pos_count: number;
  unmatched_bank_count: number;
  total_matched_amount: number;
  total_unmatched_amount: number;
}

// Paginated Response Types

export interface PaginatedReconciliationMatchesResponse {
  items: ReconciliationMatch[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
