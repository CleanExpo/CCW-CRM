/**
 * API Client Exports
 *
 * Central export point for all API functionality.
 */

// Core API clients
export { apiClient, createClient, ApiClientError } from "./client";
// Server API should be imported directly in Server Components only
// export { serverApiClient, createClient as createServerClient } from "./server";
export { updateSession } from "./middleware";

// Domain API clients
export { authApi } from "./auth";
export { ordersApi } from "./orders";
export { quotesApi } from "./quotes";
export { customersApi } from "./customers";
export { productsApi } from "./products";
export { inventoryApi } from "./inventory";
export { purchaseOrdersApi } from "./purchase-orders";
export { suppliersApi } from "./suppliers";
export { shipmentsApi } from "./shipments";

// Auth types
export type { User, LoginRequest, LoginResponse, RegisterRequest, RegisterResponse } from "./auth";

// Core types
export type { ApiError } from "./client";

// Orders types
export type {
  Order,
  OrderItem,
  OrderCreate,
  OrderUpdate,
  OrderStatus,
  OrderListParams,
  PaginatedOrders,
  OrderActivity,
} from "./orders";

// Quotes types
export type {
  Quote,
  QuoteItem,
  QuoteCreate,
  QuoteUpdate,
  QuoteStatus,
  QuoteListParams,
  PaginatedQuotes,
  GenerateQuoteRequest,
} from "./quotes";

// Customers types
export type {
  Customer,
  CustomerCreate,
  CustomerUpdate,
  CustomerListParams,
  PaginatedCustomers,
} from "./customers";

// Products types
export type {
  Product,
  ProductCategory,
  ProductCreate,
  ProductUpdate,
  ProductListParams,
  PaginatedProducts,
  StockByLocation,
} from "./products";

// Inventory types
export type {
  InventoryItem,
  InventoryListParams,
  PaginatedInventory,
  StockHealthItem,
  StockHealth,
  TransferSuggestion,
  StockTransfer,
  StockTransferCreate,
  TransferListParams,
  PaginatedTransfers,
  StockReservation,
  StockReservationCreate,
  StockAdjustment,
} from "./inventory";

// Purchase Orders types
export type {
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatus,
  PurchaseOrderCreate,
  PurchaseOrderUpdate,
  PurchaseOrderListParams,
  PaginatedPurchaseOrders,
  Receipt,
  ReceiveStockRequest,
} from "./purchase-orders";

// Suppliers types
export type {
  Supplier,
  SupplierCreate,
  SupplierUpdate,
  SupplierListParams,
  PaginatedSuppliers,
} from "./suppliers";

// Shipments types
export type {
  Shipment,
  ShipmentStatus,
  ShipmentCreate,
  ShipmentUpdate,
  ShipmentListParams,
  PaginatedShipments,
  TrackingUpdate,
} from "./shipments";
