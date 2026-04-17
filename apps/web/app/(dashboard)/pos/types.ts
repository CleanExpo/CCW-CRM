/**
 * POS System Types
 */

export interface Location {
  id: string;
  code: string;
  name: string;
  location_type: "physical" | "virtual";
  address?: string | null;
  city: string | null;
  state: string | null;
  postal_code?: string | null;
  country?: string | null;
  timezone?: string | null;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface SalesStaff {
  id: string;
  staff_code: string;
  full_name: string;
  email: string | null;
  phone?: string | null;
  primary_location_code: string;
  can_sell_at_locations?: string[];
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface POSTerminal {
  id: string;
  terminal_id: string;
  location_code: string;
  terminal_type: string;
  merchant_id?: string | null;
  is_active: boolean;
  last_ping_at?: string | null;
}

export interface CartItem {
  product_id: string;
  sku: string;
  name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  is_active: boolean;
}

export type PaymentMethod = "eftpos" | "amex" | "cash" | "bank_transfer";

export interface POSTransaction {
  id: string;
  transaction_number: string;
  terminal_id: string;
  sales_staff_id: string | null;
  location_code: string;
  resolved_location_code: string;
  transaction_type: "sale" | "refund" | "void";
  payment_method: PaymentMethod;
  amount: number;
  payment_status: "pending" | "authorized" | "captured" | "failed" | "refunded";
  created_at: string;
}

export interface CreateTransactionRequest {
  terminal_id: string;
  sales_staff_id?: string;
  customer_id?: string;
  payment_method: PaymentMethod;
  amount: number;
  items: {
    product_id: string;
    quantity: number;
    unit_price: number;
  }[];
}
