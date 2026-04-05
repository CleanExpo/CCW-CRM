/**
 * TypeScript types for invoicing module (UNI-173)
 */

export interface InvoiceItem {
  id?: string;
  invoice_id?: string;
  product_id?: string | null;
  description: string;
  quantity: number;
  unit_price: string | number;
  tax_rate: string | number;
  tax_amount?: string | number;
  subtotal?: string | number;
  total?: string | number;
  created_at?: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  customer_name?: string;
  order_id?: string | null;
  issue_date: string;
  due_date: string;
  status: "draft" | "sent" | "partial" | "paid" | "overdue" | "cancelled";
  subtotal: string | number;
  tax_rate: string | number;
  tax_amount: string | number;
  total: string | number;
  amount_paid: string | number;
  amount_due: string | number;
  notes?: string | null;
  payment_terms: string;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  items?: InvoiceItem[];
}

export interface InvoicePayment {
  id: string;
  invoice_id: string;
  amount: string | number;
  payment_method: "cash" | "card" | "account" | "bank_transfer";
  payment_date: string;
  reference_number?: string | null;
  notes?: string | null;
  created_at: string;
  created_by?: string | null;
}

export interface CreateInvoiceData {
  customer_id: string;
  order_id?: string | null;
  issue_date?: string;
  due_date: string;
  notes?: string | null;
  payment_terms?: string;
  tax_rate?: number;
  items: CreateInvoiceItem[];
}

export interface CreateInvoiceItem {
  product_id?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate?: number;
}

export interface CreatePaymentData {
  amount: number;
  payment_method: "cash" | "card" | "account" | "bank_transfer";
  payment_date?: string;
  reference_number?: string;
  notes?: string;
}

export interface UpdateInvoiceData {
  customer_id?: string;
  issue_date?: string;
  due_date?: string;
  notes?: string;
  payment_terms?: string;
  status?: string;
}

export interface PaginatedInvoiceResponse {
  items: Invoice[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
