/**
 * API Client Exports
 *
 * Central export point for all API functionality.
 */

// Core API clients
export { apiClient, createClient, ApiClientError } from './client';
// Server API should be imported directly in Server Components only
// export { serverApiClient, createClient as createServerClient } from "./server";
export { updateSession } from './middleware';

// Domain API clients
export { authApi } from './auth';
export { ordersApi } from './orders';
export { quotesApi } from './quotes';
export { customersApi } from './customers';
export { productsApi } from './products';
export { inventoryApi } from './inventory';
export { purchaseOrdersApi } from './purchase-orders';
export { suppliersApi } from './suppliers';
export { shipmentsApi } from './shipments';
export { activitiesApi } from './activities';
export { contactsApi } from './contacts';

// Auth types
export type { User, LoginRequest, LoginResponse, RegisterRequest, RegisterResponse } from './auth';

// Core types
export type { ApiError } from './client';

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
} from './orders';

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
} from './quotes';

// Customers types
export type {
  Customer,
  CustomerCreate,
  CustomerUpdate,
  CustomerListParams,
  PaginatedCustomers,
} from './customers';

// Products types
export type {
  Product,
  ProductCategory,
  ProductCreate,
  ProductUpdate,
  ProductListParams,
  PaginatedProducts,
} from './products';

// Inventory types - exported from centralized types
export type {
  InventoryItem,
  StockByLocation,
  StockTransfer,
  StockReservation,
  StockAdjustment,
  StockAlert,
  StockHealth,
  CreateStockTransferRequest,
  CreateStockReservationRequest,
  CreateStockAdjustmentRequest,
  PaginatedInventoryResponse,
  PaginatedTransfersResponse,
  PaginatedReservationsResponse,
  PaginatedAdjustmentsResponse,
  StoreLocation,
  TransferStatus,
  ReservationStatus,
  AdjustmentType,
  InventorySummary,
  LocationStock,
} from '@/lib/types/inventory';

// Inventory API param types
export type {
  InventoryListParams,
  TransferListParams,
  StockHealthItem,
  TransferSuggestion,
} from './inventory';

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
} from './purchase-orders';

// Suppliers types
export type {
  Supplier,
  SupplierCreate,
  SupplierUpdate,
  SupplierListParams,
  PaginatedSuppliers,
} from './suppliers';

// Shipments types
export type {
  Shipment,
  ShipmentStatus,
  ShipmentCreate,
  ShipmentUpdate,
  ShipmentListParams,
  PaginatedShipments,
  TrackingUpdate,
} from './shipments';

// Activities types - exported from centralized types
export type {
  Activity,
  ActivityWithRelations,
  ActivityType,
  CreateActivityRequest,
  UpdateActivityRequest,
  PaginatedActivities,
  ActivityStats,
  ActivityTypeConfig,
  ACTIVITY_TYPE_CONFIG,
  isTask,
  isCompleted,
  isOverdue,
  getActivityStatus,
} from '@/lib/types/activities';

// Activities API param types
export type { ActivityListParams } from './activities';

// Contacts types
export type {
  Contact,
  ContactWithCustomer,
  CreateContactRequest,
  UpdateContactRequest,
  PaginatedContacts,
  ContactStats,
} from '@/lib/types/contacts';

// Contacts API param types
export type { ContactListParams } from './contacts';

// Agent monitoring API client
export { agentsApi } from './agents';

// Tasks API client
export { tasksApi } from './tasks';
export type { AgentTask } from './tasks';

// Settings API client
export { settingsApi } from './settings';

// Warehouse API client
export { warehouseApi } from './warehouse';
export type {
  WarehouseOpsPayload,
  WarehouseOpsMetrics,
  ReceivingShipment,
  PickOrder,
  ReturnCase,
  WarehouseGuidance,
} from './warehouse';

// Marketing API client
export { marketingApi } from './marketing';
export type {
  MarketingStats,
  GenerateCampaignRequest,
  CampaignResponse,
  AnalyzeAudienceRequest,
  AudienceSegment,
  AudienceResponse,
  MarketingAIStats,
} from './marketing';

// Cin7 Fulfilment API client (UNI-1264)
export { cin7FulfilmentApi } from './cin7-fulfilment';
export type {
  Cin7Fulfilment,
  Cin7Invoice,
  Cin7Payment,
  FulfilmentStatus,
  InvoiceStatus,
  PaymentStatus,
  FulfilmentListResponse,
  InvoiceListResponse,
  PaymentListResponse,
  CreateFulfilmentRequest,
  UpdateFulfilmentStatusRequest,
  MarkInvoicePaidRequest,
  InvoiceSyncResponse,
} from './cin7-fulfilment';

// Approvals API client
export { approvalsApi } from './approvals';
export type {
  Approval,
  ApprovalStep,
  PaginatedApprovalResponse,
  CreateApprovalRequest,
  AddApprovalStepRequest,
  ReviewStepRequest,
} from './approvals';

// Agent monitoring types
export type {
  AgentStats,
  Agent,
  PerformanceTrends,
  PerformanceDataPoint,
  AgentInsight,
  AgentInsights,
} from './agents';

// Settings types
export type {
  AccountProfile,
  UpdateAccountRequest,
  ChangePasswordRequest,
  CompanySettings,
  UpdateCompanyRequest,
} from './settings';

// SLA API client
export { slaApi } from './sla';
export type { SLAInstance, SLARule } from './sla';

// Notifications API client (UNI-174 ST-5)
export { notificationsApi } from './notifications';
export type { Notification, UnreadCountResponse } from './notifications';

// Workflows API client (UNI-174 ST-6)
export { workflowsApi } from './workflows';
export type {
  WorkflowTemplate,
  WorkflowTemplateAction,
  WorkflowInstance,
  WorkflowTemplateCreateInput,
  WorkflowTemplateUpdateInput,
} from './workflows';
