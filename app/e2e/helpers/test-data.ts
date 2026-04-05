/**
 * Test data generators for E2E tests
 * Creates consistent test data with unique identifiers
 */

import { randomUUID } from "crypto";

/**
 * Generate a unique timestamp-based suffix
 */
function getTimestamp(): string {
  return Date.now().toString();
}

/**
 * Generate a short unique ID
 */
function getShortId(): string {
  return randomUUID().slice(0, 8);
}

/**
 * Create test product data
 */
export function createTestProduct(overrides: Partial<TestProduct> = {}): TestProduct {
  const timestamp = getTimestamp();
  return {
    sku: `TEST-${timestamp}`,
    name: `Test Product ${timestamp}`,
    description: `Test product created for E2E testing`,
    category: "hand_tools",
    price: 99.99,
    cost: 49.99,
    stock: 100,
    warehouse_location: "A-01-01",
    is_active: true,
    ...overrides,
  };
}

/**
 * Create test customer data
 */
export function createTestCustomer(overrides: Partial<TestCustomer> = {}): TestCustomer {
  const timestamp = getTimestamp();
  const shortId = getShortId();
  return {
    customer_number: `CUST-${timestamp}`,
    company_name: `Test Company ${shortId}`,
    contact_name: `Test Contact ${shortId}`,
    email: `test-${shortId}@example.com`,
    phone: "+61 2 9876 5432",
    address: "123 Test Street",
    city: "Sydney",
    state: "NSW",
    postal_code: "2000",
    country: "Australia",
    is_active: true,
    ...overrides,
  };
}

/**
 * Create test order data
 */
export function createTestOrder(customerId: string, overrides: Partial<TestOrder> = {}): TestOrder {
  return {
    customer_id: customerId,
    order_date: new Date().toISOString().split("T")[0],
    status: "draft",
    notes: "Test order created via E2E tests",
    ...overrides,
  };
}

/**
 * Create test order item
 */
export function createTestOrderItem(
  productId: string,
  overrides: Partial<TestOrderItem> = {}
): TestOrderItem {
  return {
    product_id: productId,
    quantity: 2,
    unit_price: 99.99,
    ...overrides,
  };
}

/**
 * Create test quote data
 */
export function createTestQuote(customerId: string, overrides: Partial<TestQuote> = {}): TestQuote {
  const quoteDate = new Date();
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 30); // Valid for 30 days

  return {
    customer_id: customerId,
    quote_date: quoteDate.toISOString().split("T")[0],
    valid_until: validUntil.toISOString().split("T")[0],
    status: "draft",
    notes: "Test quote created via E2E tests",
    ...overrides,
  };
}

/**
 * Create test bank account data
 */
export function createTestBankAccount(overrides: Partial<TestBankAccount> = {}): TestBankAccount {
  const shortId = getShortId();
  return {
    account_name: `Test Account ${shortId}`,
    account_number: `12345${getTimestamp().slice(-5)}`,
    bsb: "123-456",
    bank_name: "Test Bank",
    account_type: "checking" as const,
    feed_provider: "manual" as const,
    is_active: true,
    ...overrides,
  };
}

/**
 * Create test terminal data
 */
export function createTestTerminal(
  locationId: string,
  overrides: Partial<TestTerminal> = {}
): TestTerminal {
  const timestamp = getTimestamp();
  return {
    terminal_code: `TERM-${timestamp}`,
    location_id: locationId,
    terminal_type: "physical" as const,
    provider: "Test Provider",
    serial_number: `SN-${timestamp}`,
    is_active: true,
    ...overrides,
  };
}

// Type definitions
export interface TestProduct {
  sku: string;
  name: string;
  description: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  warehouse_location: string;
  is_active: boolean;
}

export interface TestCustomer {
  customer_number: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_active: boolean;
}

export interface TestOrder {
  customer_id: string;
  order_date: string;
  status: string;
  notes: string;
}

export interface TestOrderItem {
  product_id: string;
  quantity: number;
  unit_price: number;
}

export interface TestQuote {
  customer_id: string;
  quote_date: string;
  valid_until: string;
  status: string;
  notes: string;
}

export interface TestBankAccount {
  account_name: string;
  account_number: string;
  bsb: string;
  bank_name: string;
  account_type: "checking" | "savings" | "credit";
  feed_provider: "xero" | "yodlee" | "basiq" | "manual";
  is_active: boolean;
}

export interface TestTerminal {
  terminal_code: string;
  location_id: string;
  terminal_type: "physical" | "virtual";
  provider?: string;
  serial_number?: string;
  is_active: boolean;
}
