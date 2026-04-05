import { describe, it, expect } from 'vitest';
import type { Cin7Fulfilment, Cin7Invoice, Cin7Payment } from '@/lib/types/cin7';
import { FulfilmentStatus, InvoiceStatus, PaymentStatus } from '@/lib/types/cin7';

describe('Cin7 Fulfilment Types', () => {
  describe('Enums', () => {
    it('should have correct FulfilmentStatus values', () => {
      expect(FulfilmentStatus.PENDING).toBe('pending');
      expect(FulfilmentStatus.PICKING).toBe('picking');
      expect(FulfilmentStatus.PACKING).toBe('packing');
      expect(FulfilmentStatus.SHIPPED).toBe('shipped');
      expect(FulfilmentStatus.DELIVERED).toBe('delivered');
      expect(FulfilmentStatus.CANCELLED).toBe('cancelled');
    });

    it('should have correct InvoiceStatus values', () => {
      expect(InvoiceStatus.DRAFT).toBe('draft');
      expect(InvoiceStatus.SENT).toBe('sent');
      expect(InvoiceStatus.PAID).toBe('paid');
      expect(InvoiceStatus.OVERDUE).toBe('overdue');
      expect(InvoiceStatus.CANCELLED).toBe('cancelled');
    });

    it('should have correct PaymentStatus values', () => {
      expect(PaymentStatus.PENDING).toBe('pending');
      expect(PaymentStatus.COMPLETED).toBe('completed');
      expect(PaymentStatus.FAILED).toBe('failed');
      expect(PaymentStatus.REFUNDED).toBe('refunded');
    });
  });

  describe('Cin7Fulfilment Type', () => {
    it('should match backend contract', () => {
      const mockFulfilment: Cin7Fulfilment = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        cin7_order_mapping_id: '123e4567-e89b-12d3-a456-426614174001',
        status: FulfilmentStatus.PICKING,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      expect(mockFulfilment.id).toBeDefined();
      expect(mockFulfilment.status).toBe(FulfilmentStatus.PICKING);
      expect(mockFulfilment.cin7_order_mapping_id).toBeDefined();
    });

    it('should support optional shipping fields', () => {
      const mockFulfilment: Cin7Fulfilment = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        cin7_order_mapping_id: '123e4567-e89b-12d3-a456-426614174001',
        status: FulfilmentStatus.SHIPPED,
        tracking_number: 'TRACK123',
        carrier: 'AusPost',
        shipped_at: '2024-01-01T10:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T10:00:00Z',
      };

      expect(mockFulfilment.tracking_number).toBe('TRACK123');
      expect(mockFulfilment.carrier).toBe('AusPost');
      expect(mockFulfilment.shipped_at).toBeDefined();
    });
  });

  describe('Cin7Invoice Type', () => {
    it('should match backend contract', () => {
      const mockInvoice: Cin7Invoice = {
        id: '123e4567-e89b-12d3-a456-426614174002',
        cin7_order_mapping_id: '123e4567-e89b-12d3-a456-426614174001',
        amount: 1250.5,
        currency: 'AUD',
        status: InvoiceStatus.SENT,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      expect(mockInvoice.id).toBeDefined();
      expect(mockInvoice.amount).toBe(1250.5);
      expect(mockInvoice.status).toBe(InvoiceStatus.SENT);
    });
  });

  describe('Cin7Payment Type', () => {
    it('should match backend contract', () => {
      const mockPayment: Cin7Payment = {
        id: '123e4567-e89b-12d3-a456-426614174003',
        cin7_invoice_id: '123e4567-e89b-12d3-a456-426614174002',
        amount: 1250.5,
        currency: 'AUD',
        status: PaymentStatus.COMPLETED,
        created_at: '2024-01-01T00:00:00Z',
      };

      expect(mockPayment.id).toBeDefined();
      expect(mockPayment.amount).toBe(1250.5);
      expect(mockPayment.status).toBe(PaymentStatus.COMPLETED);
    });
  });
});
