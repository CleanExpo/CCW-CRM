/**
 * Cin7 Fulfilment TypeScript Types
 * Mirrors backend Pydantic schemas from apps/backend/src/db/cin7_fulfilment_models.py
 */

export enum FulfilmentStatus {
  PENDING = 'pending',
  PICKING = 'picking',
  PACKING = 'packing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

export enum InvoiceStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export interface Cin7Fulfilment {
  id: string;
  cin7_order_mapping_id: string;
  cin7_fulfilment_id?: string;
  status: FulfilmentStatus;
  pick_location?: string;
  tracking_number?: string;
  carrier?: string;
  shipped_at?: string;
  delivered_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Cin7Invoice {
  id: string;
  cin7_order_mapping_id: string;
  cin7_invoice_id?: string;
  invoice_number?: string;
  invoice_date?: string;
  due_date?: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  paid_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Cin7Payment {
  id: string;
  cin7_invoice_id?: string;
  cin7_payment_id?: string;
  payment_method?: string;
  amount: number;
  currency: string;
  payment_date?: string;
  reference?: string;
  status: PaymentStatus;
  created_at: string;
}
