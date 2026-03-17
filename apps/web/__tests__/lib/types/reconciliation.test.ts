import { describe, it, expect } from 'vitest';
import type {
  ReconciliationMatch,
  CreateInvoiceResponse,
  ReconcileResponse,
  AutoReconcileResponse,
  ReconciliationSummary,
} from '@/lib/types/reconciliation';
import { ReconciliationStatus } from '@/lib/types/reconciliation';

describe('Reconciliation Types', () => {
  describe('Enums', () => {
    it('should have correct ReconciliationStatus values', () => {
      expect(ReconciliationStatus.UNMATCHED).toBe('unmatched');
      expect(ReconciliationStatus.MATCHED).toBe('matched');
      expect(ReconciliationStatus.RECONCILED).toBe('reconciled');
      expect(ReconciliationStatus.DISPUTED).toBe('disputed');
    });
  });

  describe('ReconciliationMatch Type', () => {
    it('should match backend contract', () => {
      const mockMatch: ReconciliationMatch = {
        pos_transaction_id: '123e4567-e89b-12d3-a456-426614174000',
        pos_transaction_number: 'POS-2024-001',
        pos_amount: 125.5,
        pos_payment_method: 'eftpos',
        pos_transaction_date: '2024-01-01T10:00:00Z',
        reconciliation_status: ReconciliationStatus.MATCHED,
      };

      expect(mockMatch.pos_transaction_id).toBeDefined();
      expect(mockMatch.pos_amount).toBe(125.5);
      expect(mockMatch.reconciliation_status).toBe(ReconciliationStatus.MATCHED);
    });

    it('should support optional bank feed fields', () => {
      const mockMatch: ReconciliationMatch = {
        pos_transaction_id: '123e4567-e89b-12d3-a456-426614174000',
        pos_transaction_number: 'POS-2024-001',
        pos_amount: 125.5,
        pos_payment_method: 'eftpos',
        pos_transaction_date: '2024-01-01T10:00:00Z',
        bank_feed_id: '123e4567-e89b-12d3-a456-426614174001',
        bank_amount: 125.5,
        bank_transaction_date: '2024-01-01T10:05:00Z',
        bank_description: 'EFTPOS PAYMENT',
        reconciliation_status: ReconciliationStatus.RECONCILED,
        matched_at: '2024-01-01T12:00:00Z',
        reconciled_at: '2024-01-01T12:05:00Z',
      };

      expect(mockMatch.bank_feed_id).toBe('123e4567-e89b-12d3-a456-426614174001');
      expect(mockMatch.bank_amount).toBe(125.5);
      expect(mockMatch.reconciliation_status).toBe(ReconciliationStatus.RECONCILED);
    });
  });

  describe('CreateInvoiceResponse Type', () => {
    it('should match backend contract', () => {
      const mockResponse: CreateInvoiceResponse = {
        success: true,
        pos_transaction_id: '123e4567-e89b-12d3-a456-426614174000',
        transaction_number: 'POS-2024-001',
        xero_invoice_id: 'xero-inv-123',
        xero_invoice_number: 'INV-2024-001',
        total: 125.5,
        already_exists: false,
      };

      expect(mockResponse.success).toBe(true);
      expect(mockResponse.xero_invoice_id).toBe('xero-inv-123');
      expect(mockResponse.total).toBe(125.5);
    });
  });

  describe('ReconcileResponse Type', () => {
    it('should match backend contract', () => {
      const mockResponse: ReconcileResponse = {
        success: true,
        pos_transaction_id: '123e4567-e89b-12d3-a456-426614174000',
        bank_feed_id: '123e4567-e89b-12d3-a456-426614174001',
        xero_payment_id: 'xero-pay-123',
        amount: 125.5,
        reconciliation_status: 'reconciled',
      };

      expect(mockResponse.success).toBe(true);
      expect(mockResponse.xero_payment_id).toBe('xero-pay-123');
      expect(mockResponse.reconciliation_status).toBe('reconciled');
    });
  });

  describe('AutoReconcileResponse Type', () => {
    it('should match backend contract', () => {
      const mockResponse: AutoReconcileResponse = {
        success: true,
        matches_found: 15,
        invoices_created: 12,
        payments_reconciled: 10,
        errors: ['Transaction TX-001 amount mismatch'],
      };

      expect(mockResponse.success).toBe(true);
      expect(mockResponse.matches_found).toBe(15);
      expect(mockResponse.errors).toHaveLength(1);
    });
  });

  describe('ReconciliationSummary Type', () => {
    it('should match backend contract', () => {
      const mockSummary: ReconciliationSummary = {
        total_pos_transactions: 100,
        total_bank_feeds: 95,
        matched_count: 85,
        reconciled_count: 80,
        unmatched_pos_count: 15,
        unmatched_bank_count: 10,
        total_matched_amount: 12550.75,
        total_unmatched_amount: 1250.25,
      };

      expect(mockSummary.total_pos_transactions).toBe(100);
      expect(mockSummary.matched_count).toBe(85);
      expect(mockSummary.total_matched_amount).toBe(12550.75);
    });
  });
});
