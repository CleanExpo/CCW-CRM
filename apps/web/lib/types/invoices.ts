/**
 * Invoice TypeScript Types
 * Mirrors backend Pydantic schemas from apps/backend/src/api/schemas/invoicing.py
 */

export enum InvoiceStatus {
  DRAFT = "draft",
  SENT = "sent",
  PAID = "paid",
  OVERDUE = "overdue",
  CANCELLED = "cancelled",
}

export enum PaymentMethod {
  CASH = "cash",
  CHECK = "check",
  BANK_TRANSFER = "bank_transfer",
  CREDIT_CARD = "credit_card",
  OTHER = "other",
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string;
  product_name?: string;  // Populated by backend join
  product_sku?: string;   // Populated by backend join
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  tax_amount: number;
  subtotal: number;       // Calculated: quantity × unit_price
  total: number;          // Calculated: subtotal + tax_amount
  created_at: string;
  updated_at: string;
}

export interface InvoicePayment {
  id: string;
  invoice_id: string;
  payment_date: string;   // ISO date string
  amount: number;
  payment_method: PaymentMethod;
  reference_number?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string; // Format: INV-YYYY-NNNN
  order_id?: string;
  customer_id: string;
  customer_name?: string; // Populated by backend join
  customer_email?: string; // Populated by backend join
  invoice_date: string;   // ISO date string
  due_date: string;       // ISO date string
  status: InvoiceStatus;
  notes?: string;
  subtotal: number;       // Calculated from items
  tax_total: number;      // Calculated from items
  total: number;          // subtotal + tax_total
  amount_paid: number;    // Sum of payments
  amount_due: number;     // total - amount_paid
  items: InvoiceItem[];
  payments?: InvoicePayment[];
  created_at: string;
  updated_at: string;
}

export interface InvoiceSummary {
  id: string;
  invoice_number: string;
  customer_name: string;
  invoice_date: string;
  due_date: string;
  status: InvoiceStatus;
  total: number;
  amount_due: number;
  item_count: number;
}

export interface PaginatedInvoicesResponse {
  data: InvoiceSummary[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface CreateInvoiceItemRequest {
  product_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate?: number;
  tax_amount?: number;
}

export interface CreateInvoiceRequest {
  order_id?: string;
  customer_id: string;
  invoice_date: string;
  due_date: string;
  notes?: string;
  items: CreateInvoiceItemRequest[];
}

export interface UpdateInvoiceRequest {
  customer_id?: string;
  invoice_date?: string;
  due_date?: string;
  notes?: string;
  items?: CreateInvoiceItemRequest[];
}

export interface RecordPaymentRequest {
  payment_date: string;
  amount: number;
  payment_method: PaymentMethod;
  reference_number?: string;
  notes?: string;
}

export interface RevenueSummary {
  total_revenue: number;
  total_outstanding: number;
  total_overdue: number;
  invoice_count: number;
  paid_invoice_count: number;
  overdue_invoice_count: number;
}

export interface TaxSummary {
  total_tax_collected: number;
  tax_by_rate: Array<{
    tax_rate: number;
    total_tax: number;
    invoice_count: number;
  }>;
}

/**
 * Helper type for invoice form data (used with React Hook Form)
 */
export interface InvoiceFormData {
  customer_id: string;
  invoice_date: Date;
  due_date: Date;
  notes?: string;
  items: Array<{
    product_id: string;
    description: string;
    quantity: number;
    unit_price: number;
    tax_rate: number;
  }>;
}

/**
 * Helper type for payment form data (used with React Hook Form)
 */
export interface PaymentFormData {
  payment_date: Date;
  amount: number;
  payment_method: PaymentMethod;
  reference_number?: string;
  notes?: string;
}
