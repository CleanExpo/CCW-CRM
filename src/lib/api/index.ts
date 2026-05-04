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
export { copilotApi } from './copilot';
export type { CopilotQueryRequest, CopilotQueryResponse, CopilotMessage } from './copilot';
export { shadowApi } from './shadow';
export type {
  ShadowStatusResponse,
  ShadowSessionResponse,
  ReadinessScoreResponse,
  AiOpportunity,
} from './shadow';

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
} from '@/types/inventory';

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
} from '@/types/activities';

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
} from '@/types/contacts';

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

// Marketplace API client (multi-channel sync)
export { marketplaceApi } from './marketplace';
export type {
  SetupField,
  ChannelInfo,
  ChannelListResponse,
  ConnectResponse,
  ProductListing,
  SyncProductsResponse,
  SyncStatusChannel,
  SyncStatusResponse,
  SyncInventoryResponse,
  MarketplaceOrder,
  OrderFeedResponse,
  ChannelSetupFieldsResponse,
} from './marketplace';

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

// Billing API client (Stripe subscription management)
export { billingApi } from './billing';
export type {
  Subscription,
  SubscriptionTier,
  SubscriptionStatus,
  BillingInterval,
  SubscribeRequest,
  UpdateSubscriptionRequest,
  Invoice as BillingInvoice,
  PaymentMethod,
} from './billing';

// Workshop API client (equipment servicing, bookings, reminders)
export { workshopApi } from './workshop';
export type {
  Equipment,
  EquipmentCreate,
  EquipmentStatus,
  ServiceTemplate,
  ServiceTemplateItem,
  WorkshopBooking,
  BookingStatus,
  ServiceReminder,
  ReminderStatus,
  DashboardData as WorkshopDashboardData,
} from './workshop';

// Invoices API client (UNI-173)
export { invoicesApi } from './invoices';

// AI Chat API client
export {
  createNewConversation,
  sendMessage,
  streamMessage,
  getConversationHistory,
  deleteConversation,
} from './ai-chat';

// AI Generate API client
export { generateQuote, generateEmail, generateSummary } from './ai-generate';

// AI Insights API client
export { generateInsights, getDashboardInsights, getInsightHistory } from './ai-insights';

// AP2 Payment API client
export {
  createIntentMandate,
  createCartMandate,
  createPaymentMandate,
  verifyMandate,
  executePayment,
  getPaymentStatus,
  listMandates,
  listTransactions,
  createVoiceSession,
  processVoiceInput,
} from './ap2';

// Autonomy Metrics API client
export { getAutonomyMetrics, getAutonomyHealth, getAutonomyAnomalies } from './autonomy';

// Autonomous Execution API client (Phase 6: Execution Dashboard)
export { autonomousApi } from './autonomous';
export type {
  TaskStatus,
  GateStatus,
  ApprovalGate,
  TaskMetadata,
  TaskState,
  AutonomousEvent,
  StartAutonomousRequest,
  StartAutonomousResponse,
  GetTaskStatusResponse,
  ApproveGateRequest,
  RejectGateRequest,
  ApproveGateResponse,
  RejectGateResponse,
  ListGatesResponse,
} from './autonomous';

// Bank Feeds API client
export {
  listUnreconciledFeeds,
  listBankAccounts,
  getReconciliationStats,
  getReconciliationAlerts,
  syncBankFeeds,
} from './bank-feeds';

// Cin7 core API client
export {
  getCin7Status,
  connectCin7,
  disconnectCin7,
  triggerCin7Sync,
  getCin7SyncLogs,
} from './cin7';

// Cin7 BOM API client
export { listBoms, syncBoms, getBom, listProductionRuns, createProductionRun } from './cin7-bom';

// Cin7 GL API client
export {
  listAccounts as listGlAccounts,
  syncChartOfAccounts,
  listJournalEntries,
  createJournalEntry,
  postJournalEntry,
  listAccountMappings,
  upsertAccountMapping,
} from './cin7-gl';

// Cin7 GRN API client
export { cin7GrnApi } from './cin7-grn';

// Cin7 Inventory Write-back API client
export { cin7InventoryWritebackApi } from './cin7-inventory-writeback';

// Cin7 Shadow Sync API client
export {
  triggerShadowPoll,
  getShadowStatus,
  listSyncGaps,
  getSyncGapsSummary,
  updateGapStatus,
} from './cin7-shadow';

// Cin7 Shadow AI API client
export { analyzeShadowGaps, autoResolveStaleShadowGaps, getShadowAiHealth } from './cin7-shadow-ai';

// Cin7 Webhook Subscriptions API client
export {
  listWebhookSubscriptions,
  createWebhookSubscription,
  updateWebhookSubscription,
  deleteWebhookSubscription,
} from './cin7-webhook-subscriptions';

// Contractors API client
export { contractorAPI } from './contractors';

// Monitoring API client
export {
  getAlerts,
  createAlert,
  acknowledgeAlert,
  resolveAlert,
  clearOldAlerts,
  getBusinessMetrics,
  getPOSMetrics,
  getReconciliationMetrics,
  getOrderMetrics,
  getPerformanceStats,
  getAllEndpointStats,
  getSlowestEndpoints,
  getErrorEndpoints,
  getEndpointStats,
  getHealth,
  getMetrics,
  getPrometheusAlerts,
  getRangeData,
} from './monitoring';

// POS API client
export {
  getLocations as getPosLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  getStaff,
  createStaff,
  updateStaff,
  deleteStaff,
  getTerminals,
  getTransactions,
} from './pos';

// SendGrid API client
export {
  getSendGridStatus,
  configureSendGrid,
  disconnectSendGrid,
  sendEmail,
  listConversations,
  getConversation,
  simulateInboundEmail,
} from './sendgrid';

// Service Requests API client
export {
  getServiceRequests,
  getServiceRequest,
  createServiceRequest,
  updateServiceRequest,
  deleteServiceRequest,
} from './service-requests';

// Outbound Shipments API client
export { outboundShipmentsApi } from './shipments-outbound';

// Shopify API client
export {
  getShopifyStatus,
  connectShopify,
  disconnectShopify,
  importShopifyOrder,
  importRecentShopifyOrders,
  syncProductInventory,
  syncAllInventory,
  syncProductToShopify,
  isShopifyConnected,
} from './shopify';

// Team API client
export { teamApi } from './team';

// Xero API client
export {
  startXeroAuth,
  getXeroStatus,
  disconnectXero,
  syncOrderToXero,
  bulkSyncOrders,
  getXeroInvoice,
  isXeroConnected,
} from './xero';

// Document Extraction API client
export { documentsApi } from './documents';
export type {
  ExtractedInvoiceData,
  ExtractedPOData,
  ExtractionResponse,
  CreateFromExtractionResponse,
  ExtractedLineItem,
} from './documents';
