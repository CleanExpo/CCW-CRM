# Models Catalog — CCW ERP/CRM Database

# Last Updated: 2026-03-25

# Total Models: 126

# Source: apps/backend/src/db/

# WARNING: demo_models.py is LOCKED — do not modify without explicit approval

---

## Core Models (demo_models.py — LOCKED)

### MODEL-001: Organization

- **Table**: organizations
- **File**: `apps/backend/src/db/demo_models.py` (LOCKED)
- **Status**: Active — SCHEMA LOCKED

### MODEL-002: Product

- **Table**: products
- **File**: `apps/backend/src/db/demo_models.py` (LOCKED)
- **Enums**: ProductCategory (heavy_machinery, hand_tools, power_tools, safety_equipment, building_materials, electrical, plumbing, accessories)
- **Status**: Active — SCHEMA LOCKED

### MODEL-003: Customer

- **Table**: customers
- **File**: `apps/backend/src/db/demo_models.py` (LOCKED)
- **Status**: Active — SCHEMA LOCKED

### MODEL-004: Order

- **Table**: orders
- **File**: `apps/backend/src/db/demo_models.py` (LOCKED)
- **Enums**: OrderStatus (draft, pending, confirmed, processing, shipped, delivered, cancelled)
- **Status**: Active — SCHEMA LOCKED

### MODEL-005: OrderItem

- **Table**: order_items
- **File**: `apps/backend/src/db/demo_models.py` (LOCKED)
- **Status**: Active — SCHEMA LOCKED

### MODEL-006: OrderActivity

- **Table**: order_activity
- **File**: `apps/backend/src/db/demo_models.py` (LOCKED)
- **Status**: Active — SCHEMA LOCKED

### MODEL-007: Quote

- **Table**: quotes
- **File**: `apps/backend/src/db/demo_models.py` (LOCKED)
- **Enums**: QuoteStatus (draft, pending, sent, accepted, rejected, expired)
- **Status**: Active — SCHEMA LOCKED

### MODEL-008: QuoteItem

- **Table**: quote_items
- **File**: `apps/backend/src/db/demo_models.py` (LOCKED)
- **Status**: Active — SCHEMA LOCKED

### MODEL-009: ConversationHistory

- **Table**: conversation_history
- **File**: `apps/backend/src/db/demo_models.py` (LOCKED)
- **Status**: Active — SCHEMA LOCKED

### MODEL-010: AgentExecution

- **Table**: agent_executions
- **File**: `apps/backend/src/db/demo_models.py` (LOCKED)
- **Status**: Active — SCHEMA LOCKED

### MODEL-011: AIGeneratedContent

- **Table**: ai_generated_content
- **File**: `apps/backend/src/db/demo_models.py` (LOCKED)
- **Status**: Active — SCHEMA LOCKED

### MODEL-012: BackgroundJob

- **Table**: background_jobs
- **File**: `apps/backend/src/db/demo_models.py` (LOCKED)
- **Enums**: JobStatus (pending, processing, completed, failed, cancelled)
- **Status**: Active — SCHEMA LOCKED

---

## Base Models (models_base.py)

### MODEL-013: User

- **Table**: users
- **File**: `apps/backend/src/db/models_base.py`
- **Status**: Active

### MODEL-014: Contractor

- **Table**: contractors
- **File**: `apps/backend/src/db/models_base.py`
- **Status**: Active

### MODEL-015: AvailabilitySlot

- **Table**: availability_slots
- **File**: `apps/backend/src/db/models_base.py`
- **Status**: Active

### MODEL-016: Document

- **Table**: documents
- **File**: `apps/backend/src/db/models_base.py`
- **Status**: Active

---

## Cin7 Integration Models (cin7_models.py)

### MODEL-017: Cin7Connection

- **Table**: cin7_connections
- **File**: `apps/backend/src/db/cin7_models.py`
- **Status**: Active

### MODEL-018: Cin7ProductMapping

- **Table**: cin7_product_mappings
- **File**: `apps/backend/src/db/cin7_models.py`
- **Status**: Active

### MODEL-019: Cin7CustomerMapping

- **Table**: cin7_customer_mappings
- **File**: `apps/backend/src/db/cin7_models.py`
- **Status**: Active

### MODEL-020: Cin7OrderMapping

- **Table**: cin7_order_mappings
- **File**: `apps/backend/src/db/cin7_models.py`
- **Status**: Active

### MODEL-021: Cin7QuoteMapping

- **Table**: cin7_quote_mappings
- **File**: `apps/backend/src/db/cin7_models.py`
- **Status**: Active

### MODEL-022: Cin7SupplierMapping

- **Table**: cin7_supplier_mappings
- **File**: `apps/backend/src/db/cin7_models.py`
- **Status**: Active

### MODEL-023: Cin7PurchaseOrderMapping

- **Table**: cin7_purchase_order_mappings
- **File**: `apps/backend/src/db/cin7_models.py`
- **Status**: Active

### MODEL-024: Cin7WebhookSubscription

- **Table**: cin7_webhook_subscriptions
- **File**: `apps/backend/src/db/cin7_models.py`
- **Status**: Active

### MODEL-025: Cin7SyncLog

- **Table**: cin7_sync_logs
- **File**: `apps/backend/src/db/cin7_models.py`
- **Status**: Active

### MODEL-026: Cin7OrderLineItem

- **Table**: cin7_order_line_items
- **File**: `apps/backend/src/db/cin7_models.py`
- **Status**: Active

### MODEL-027: Cin7PurchaseOrderLineItem

- **Table**: cin7_purchase_order_line_items
- **File**: `apps/backend/src/db/cin7_models.py`
- **Status**: Active

### MODEL-028: Cin7GoodsReceipt

- **Table**: cin7_goods_receipts
- **File**: `apps/backend/src/db/cin7_models.py`
- **Status**: Active

### MODEL-029: Cin7GoodsReceiptLine

- **Table**: cin7_goods_receipt_lines
- **File**: `apps/backend/src/db/cin7_models.py`
- **Status**: Active

### MODEL-030: Cin7StockAdjustment

- **Table**: cin7_stock_adjustments
- **File**: `apps/backend/src/db/cin7_models.py`
- **Status**: Active

### MODEL-031: Cin7StockTransfer

- **Table**: cin7_stock_transfers
- **File**: `apps/backend/src/db/cin7_models.py`
- **Status**: Active

### MODEL-032: Cin7StockTake

- **Table**: cin7_stock_takes
- **File**: `apps/backend/src/db/cin7_models.py`
- **Status**: Active

### MODEL-033: Cin7StockTakeLine

- **Table**: cin7_stock_take_lines
- **File**: `apps/backend/src/db/cin7_models.py`
- **Status**: Active

---

## Cin7 Shadow Models (cin7_shadow_models.py)

### MODEL-034: Cin7ShadowSync

- **Table**: cin7_shadow_syncs
- **File**: `apps/backend/src/db/cin7_shadow_models.py`
- **Status**: Active

### MODEL-035: Cin7SyncGap

- **Table**: cin7_sync_gaps
- **File**: `apps/backend/src/db/cin7_shadow_models.py`
- **Status**: Active

---

## Cin7 BOM Models (cin7_bom_models.py)

### MODEL-036: Cin7BomMaster

- **Table**: cin7_bom_masters
- **File**: `apps/backend/src/db/cin7_bom_models.py`
- **Status**: Active

### MODEL-037: Cin7BomComponent

- **Table**: cin7_bom_components
- **File**: `apps/backend/src/db/cin7_bom_models.py`
- **Status**: Active

### MODEL-038: Cin7ProductionRun

- **Table**: cin7_production_runs
- **File**: `apps/backend/src/db/cin7_bom_models.py`
- **Status**: Active

---

## Cin7 Fulfilment Models (cin7_fulfilment_models.py)

### MODEL-039: Cin7Fulfilment

- **Table**: cin7_fulfilments
- **File**: `apps/backend/src/db/cin7_fulfilment_models.py`
- **Status**: Active

### MODEL-040: Cin7Invoice

- **Table**: cin7_invoices
- **File**: `apps/backend/src/db/cin7_fulfilment_models.py`
- **Status**: Active

### MODEL-041: Cin7Payment

- **Table**: cin7_payments
- **File**: `apps/backend/src/db/cin7_fulfilment_models.py`
- **Status**: Active

---

## Cin7 GL Models (cin7_gl_models.py)

### MODEL-042: Cin7ChartOfAccount

- **Table**: cin7_chart_of_accounts
- **File**: `apps/backend/src/db/cin7_gl_models.py`
- **Status**: Active

### MODEL-043: Cin7JournalEntry

- **Table**: cin7_journal_entries
- **File**: `apps/backend/src/db/cin7_gl_models.py`
- **Status**: Active

### MODEL-044: Cin7JournalLine

- **Table**: cin7_journal_lines
- **File**: `apps/backend/src/db/cin7_gl_models.py`
- **Status**: Active

### MODEL-045: Cin7AccountMapping

- **Table**: cin7_account_mappings
- **File**: `apps/backend/src/db/cin7_gl_models.py`
- **Status**: Active

---

## POS Models (pos_models.py)

### MODEL-046: Location

- **Table**: locations
- **File**: `apps/backend/src/db/pos_models.py`
- **Status**: Active

### MODEL-047: SalesStaff

- **Table**: sales_staff
- **File**: `apps/backend/src/db/pos_models.py`
- **Status**: Active

### MODEL-048: POSTerminal

- **Table**: pos_terminals
- **File**: `apps/backend/src/db/pos_models.py`
- **Status**: Active

### MODEL-049: BankAccount

- **Table**: bank_accounts
- **File**: `apps/backend/src/db/pos_models.py`
- **Status**: Active

### MODEL-050: POSTransaction

- **Table**: pos_transactions
- **File**: `apps/backend/src/db/pos_models.py`
- **Status**: Active

### MODEL-051: BankFeed

- **Table**: bank_feeds
- **File**: `apps/backend/src/db/pos_models.py`
- **Status**: Active

---

## Webhook Models (webhook_models.py)

### MODEL-052: WebhookEvent

- **Table**: webhook_events
- **File**: `apps/backend/src/db/webhook_models.py`
- **Status**: Active

### MODEL-053: WebhookMetrics

- **Table**: webhook_metrics
- **File**: `apps/backend/src/db/webhook_models.py`
- **Status**: Active

---

## CRM Models (crm_models.py)

### MODEL-054: Contact

- **Table**: contacts
- **File**: `apps/backend/src/db/crm_models.py`
- **Status**: Active

### MODEL-055: Activity

- **Table**: activities
- **File**: `apps/backend/src/db/crm_models.py`
- **Status**: Active

---

## Customer Health Models (customer_health_models.py)

### MODEL-056: CustomerPersona

- **Table**: customer_personas
- **File**: `apps/backend/src/db/customer_health_models.py`
- **Status**: Active

### MODEL-057: OnboardingSequence

- **Table**: onboarding_sequences
- **File**: `apps/backend/src/db/customer_health_models.py`
- **Status**: Active

### MODEL-058: OnboardingTouchpoint

- **Table**: onboarding_touchpoints
- **File**: `apps/backend/src/db/customer_health_models.py`
- **Status**: Active

---

## Inventory Models (inventory_models.py)

### MODEL-059: ProductStockByLocation

- **Table**: product_stock_by_location
- **File**: `apps/backend/src/db/inventory_models.py`
- **Status**: Active

### MODEL-060: StockTransfer

- **Table**: stock_transfers
- **File**: `apps/backend/src/db/inventory_models.py`
- **Status**: Active

### MODEL-061: StockReservation

- **Table**: stock_reservations
- **File**: `apps/backend/src/db/inventory_models.py`
- **Status**: Active

### MODEL-062: StockAdjustment

- **Table**: stock_adjustments
- **File**: `apps/backend/src/db/inventory_models.py`
- **Status**: Active

### MODEL-063: Supplier

- **Table**: suppliers
- **File**: `apps/backend/src/db/inventory_models.py`
- **Status**: Active

### MODEL-064: PurchaseOrder

- **Table**: purchase_orders
- **File**: `apps/backend/src/db/inventory_models.py`
- **Status**: Active

### MODEL-065: PurchaseOrderItem

- **Table**: purchase_order_items
- **File**: `apps/backend/src/db/inventory_models.py`
- **Status**: Active

### MODEL-066: InboundShipment

- **Table**: inbound_shipments
- **File**: `apps/backend/src/db/inventory_models.py`
- **Status**: Active

### MODEL-067: OutboundShipment

- **Table**: outbound_shipments
- **File**: `apps/backend/src/db/inventory_models.py`
- **Status**: Active

### MODEL-068: CarrierConfiguration

- **Table**: carrier_configurations
- **File**: `apps/backend/src/db/inventory_models.py`
- **Status**: Active

### MODEL-069: ProductBarcode

- **Table**: product_barcodes
- **File**: `apps/backend/src/db/inventory_models.py`
- **Status**: Active

### MODEL-070: StockTake

- **Table**: stock_takes
- **File**: `apps/backend/src/db/inventory_models.py`
- **Status**: Active

### MODEL-071: StockTakeItem

- **Table**: stock_take_items
- **File**: `apps/backend/src/db/inventory_models.py`
- **Status**: Active

### MODEL-072: ReorderRule

- **Table**: reorder_rules
- **File**: `apps/backend/src/db/inventory_models.py`
- **Status**: Active

### MODEL-073: ProductAttribute

- **Table**: product_attributes
- **File**: `apps/backend/src/db/inventory_models.py`
- **Status**: Active

### MODEL-074: ProductVariant

- **Table**: product_variants
- **File**: `apps/backend/src/db/inventory_models.py`
- **Status**: Active

---

## i18n Models (i18n_models.py)

### MODEL-075: Language

- **Table**: languages
- **File**: `apps/backend/src/db/i18n_models.py`
- **Status**: Active

### MODEL-076: ProductTranslation

- **Table**: product_translations
- **File**: `apps/backend/src/db/i18n_models.py`
- **Status**: Active

### MODEL-077: CategoryTranslation

- **Table**: category_translations
- **File**: `apps/backend/src/db/i18n_models.py`
- **Status**: Active

### MODEL-078: UITranslation

- **Table**: ui_translations
- **File**: `apps/backend/src/db/i18n_models.py`
- **Status**: Active

### MODEL-079: EmailTemplateTranslation

- **Table**: email_template_translations
- **File**: `apps/backend/src/db/i18n_models.py`
- **Status**: Active

### MODEL-080: TranslationQueue

- **Table**: translation_queue
- **File**: `apps/backend/src/db/i18n_models.py`
- **Status**: Active

---

## Invoicing Models (models/invoicing.py)

### MODEL-081: TaxRate

- **Table**: tax_rates
- **File**: `apps/backend/src/db/models/invoicing.py`
- **Status**: Active

### MODEL-082: Invoice

- **Table**: invoices
- **File**: `apps/backend/src/db/models/invoicing.py`
- **Status**: Active

### MODEL-083: InvoiceItem

- **Table**: invoice_items
- **File**: `apps/backend/src/db/models/invoicing.py`
- **Status**: Active

### MODEL-084: InvoicePayment

- **Table**: invoice_payments
- **File**: `apps/backend/src/db/models/invoicing.py`
- **Status**: Active

---

## PRD Models (models/prd.py)

### MODEL-085: PRD

- **Table**: prds
- **File**: `apps/backend/src/db/models/prd.py`
- **Status**: Active

### MODEL-086: AgentRun

- **Table**: agent_runs
- **File**: `apps/backend/src/db/models/prd.py`
- **Status**: Active

### MODEL-087: APIUsage

- **Table**: api_usage
- **File**: `apps/backend/src/db/models/prd.py`
- **Status**: Active

---

## Subscription Models (models/subscription.py)

### MODEL-088: Subscription

- **Table**: subscriptions
- **File**: `apps/backend/src/db/models/subscription.py`
- **Status**: Active

---

## AP2 Models (ap2_models.py)

### MODEL-089: AP2Connection

- **Table**: ap2_connections
- **File**: `apps/backend/src/db/ap2_models.py`
- **Status**: Active

### MODEL-090: AP2Mandate

- **Table**: ap2_mandates
- **File**: `apps/backend/src/db/ap2_models.py`
- **Status**: Active

### MODEL-091: AP2Transaction

- **Table**: ap2_transactions
- **File**: `apps/backend/src/db/ap2_models.py`
- **Status**: Active

### MODEL-092: AP2VoiceSession

- **Table**: ap2_voice_sessions
- **File**: `apps/backend/src/db/ap2_models.py`
- **Status**: Active

### MODEL-093: AP2AgentInteraction

- **Table**: ap2_agent_interactions
- **File**: `apps/backend/src/db/ap2_models.py`
- **Status**: Active

### MODEL-094: AP2WebhookLog

- **Table**: ap2_webhook_logs
- **File**: `apps/backend/src/db/ap2_models.py`
- **Status**: Active

---

## Approvals Models (approvals_models.py)

### MODEL-095: Approval

- **Table**: approvals
- **File**: `apps/backend/src/db/approvals_models.py`
- **Status**: Active

### MODEL-096: ApprovalStep

- **Table**: approval_steps
- **File**: `apps/backend/src/db/approvals_models.py`
- **Status**: Active

---

## Container Models (container_models.py)

### MODEL-097: Container

- **Table**: containers
- **File**: `apps/backend/src/db/container_models.py`
- **Status**: Active

### MODEL-098: ContainerItem

- **Table**: container_items
- **File**: `apps/backend/src/db/container_models.py`
- **Status**: Active

### MODEL-099: Backorder

- **Table**: backorders
- **File**: `apps/backend/src/db/container_models.py`
- **Status**: Active

---

## Email Models (email_models.py + email_audit_models.py)

### MODEL-100: EmailConversation

- **Table**: email_conversations
- **File**: `apps/backend/src/db/email_models.py`
- **Status**: Active

### MODEL-101: EmailMessage

- **Table**: email_messages
- **File**: `apps/backend/src/db/email_models.py`
- **Status**: Active

### MODEL-102: EmailTemplate

- **Table**: email_templates
- **File**: `apps/backend/src/db/email_models.py`
- **Status**: Active

### MODEL-103: EmailWebhookLog

- **Table**: email_webhook_logs
- **File**: `apps/backend/src/db/email_models.py`
- **Status**: Active

### MODEL-104: EmailLog

- **Table**: email_logs
- **File**: `apps/backend/src/db/email_audit_models.py`
- **Status**: Active

### MODEL-105: EmailConsent

- **Table**: email_consents
- **File**: `apps/backend/src/db/email_audit_models.py`
- **Status**: Active

---

## Shopify Models (shopify_models.py + shopify_extended_models.py)

### MODEL-106: ShopifyConnection

- **Table**: shopify_connections
- **File**: `apps/backend/src/db/shopify_models.py`
- **Status**: Active

### MODEL-107: ShopifyProductMapping

- **Table**: shopify_product_mappings
- **File**: `apps/backend/src/db/shopify_models.py`
- **Status**: Active

### MODEL-108: ShopifyOrderMapping

- **Table**: shopify_order_mappings
- **File**: `apps/backend/src/db/shopify_models.py`
- **Status**: Active

### MODEL-109: ShopifyWebhookLog

- **Table**: shopify_webhook_logs
- **File**: `apps/backend/src/db/shopify_models.py`
- **Status**: Active

### MODEL-110: ShopifyProductSyncLog

- **Table**: shopify_product_sync_logs
- **File**: `apps/backend/src/db/shopify_models.py`
- **Status**: Active

### MODEL-111: ShopifyMetafield

- **Table**: shopify_metafields
- **File**: `apps/backend/src/db/shopify_extended_models.py`
- **Status**: Active

### MODEL-112: ShopifyInventorySync

- **Table**: shopify_inventory_syncs
- **File**: `apps/backend/src/db/shopify_extended_models.py`
- **Status**: Active

### MODEL-113: ShopifyThemeEndpoint

- **Table**: shopify_theme_endpoints
- **File**: `apps/backend/src/db/shopify_extended_models.py`
- **Status**: Active

### MODEL-114: ShopifyProductTranslation

- **Table**: shopify_product_translations
- **File**: `apps/backend/src/db/shopify_extended_models.py`
- **Status**: Active

### MODEL-115: ShopifyInventorySyncQueue

- **Table**: shopify_inventory_sync_queue
- **File**: `apps/backend/src/db/shopify_extended_models.py`
- **Status**: Active

---

## Xero Models (xero_models.py)

### MODEL-116: XeroConnection

- **Table**: xero_connections
- **File**: `apps/backend/src/db/xero_models.py`
- **Status**: Active

### MODEL-117: Payment

- **Table**: payments
- **File**: `apps/backend/src/db/xero_models.py`
- **Status**: Active

---

## Portal Forms Models (portal_forms_models.py)

### MODEL-118: ContactSubmission

- **Table**: contact_submissions
- **File**: `apps/backend/src/db/portal_forms_models.py`
- **Status**: Active

### MODEL-119: DemoRequest

- **Table**: demo_requests
- **File**: `apps/backend/src/db/portal_forms_models.py`
- **Status**: Active

---

## Submission Notes (submission_notes_models.py)

### MODEL-120: SubmissionNote

- **Table**: submission_notes
- **File**: `apps/backend/src/db/submission_notes_models.py`
- **Status**: Active

---

## Service Models (service_models.py)

### MODEL-121: ServiceRequest

- **Table**: service_requests
- **File**: `apps/backend/src/db/service_models.py`
- **Status**: Active

---

## AI Models (ai_models.py)

### MODEL-122: LearningPattern

- **Table**: learning_patterns
- **File**: `apps/backend/src/db/ai_models.py`
- **Status**: Active

### MODEL-123: LearningInsight

- **Table**: learning_insights
- **File**: `apps/backend/src/db/ai_models.py`
- **Status**: Active

### MODEL-124: PromptVariant

- **Table**: prompt_variants
- **File**: `apps/backend/src/db/ai_models.py`
- **Status**: Active

---

## AI Search Models (ai_search_models.py)

### MODEL-125: ProductEmbedding

- **Table**: product_embeddings
- **File**: `apps/backend/src/db/ai_search_models.py`
- **Status**: Active

### MODEL-126: ProductRecommendation

- **Table**: product_recommendations
- **File**: `apps/backend/src/db/ai_search_models.py`
- **Status**: Active

### MODEL-127: CustomerProductInteraction

- **Table**: customer_product_interactions
- **File**: `apps/backend/src/db/ai_search_models.py`
- **Status**: Active

### MODEL-128: ProductCoOccurrence

- **Table**: product_co_occurrences
- **File**: `apps/backend/src/db/ai_search_models.py`
- **Status**: Active

### MODEL-129: SearchQuery

- **Table**: search_queries
- **File**: `apps/backend/src/db/ai_search_models.py`
- **Status**: Active

### MODEL-130: VoiceSearchSession

- **Table**: voice_search_sessions
- **File**: `apps/backend/src/db/ai_search_models.py`
- **Status**: Active

---

## Marketplace Models (marketplace_models.py)

### MODEL-131: MarketplaceConnection

- **Table**: marketplace_connections
- **File**: `apps/backend/src/db/marketplace_models.py`
- **Status**: Active

### MODEL-132: MarketplaceProductListing

- **Table**: marketplace_product_listings
- **File**: `apps/backend/src/db/marketplace_models.py`
- **Status**: Active

### MODEL-133: MarketplaceOrder

- **Table**: marketplace_orders
- **File**: `apps/backend/src/db/marketplace_models.py`
- **Status**: Active

### MODEL-134: MarketplaceInventorySync

- **Table**: marketplace_inventory_syncs
- **File**: `apps/backend/src/db/marketplace_models.py`
- **Status**: Active

### MODEL-135: MarketplaceSyncLog

- **Table**: marketplace_sync_logs
- **File**: `apps/backend/src/db/marketplace_models.py`
- **Status**: Active

---

## Workflow Models (workflow_models.py)

### MODEL-136: WorkflowTemplate

- **Table**: workflow_templates
- **File**: `apps/backend/src/db/workflow_models.py`
- **Status**: Active

### MODEL-137: WorkflowTemplateAction

- **Table**: workflow_template_actions
- **File**: `apps/backend/src/db/workflow_models.py`
- **Status**: Active

### MODEL-138: WorkflowInstance

- **Table**: workflow_instances
- **File**: `apps/backend/src/db/workflow_models.py`
- **Status**: Active

### MODEL-139: SLARule

- **Table**: sla_rules
- **File**: `apps/backend/src/db/workflow_models.py`
- **Status**: Active

### MODEL-140: SLAInstance

- **Table**: sla_instances
- **File**: `apps/backend/src/db/workflow_models.py`
- **Status**: Active

### MODEL-141: InAppNotification

- **Table**: in_app_notifications
- **File**: `apps/backend/src/db/workflow_models.py`
- **Status**: Active

---

## Workshop Models (workshop_models.py)

### MODEL-142: Equipment

- **Table**: workshop_equipment
- **File**: `apps/backend/src/db/workshop_models.py`
- **Status**: Active

### MODEL-143: ServiceTemplate

- **Table**: service_templates
- **File**: `apps/backend/src/db/workshop_models.py`
- **Status**: Active

### MODEL-144: ServiceTemplateItem

- **Table**: service_template_items
- **File**: `apps/backend/src/db/workshop_models.py`
- **Status**: Active

### MODEL-145: WorkshopBooking

- **Table**: workshop_bookings
- **File**: `apps/backend/src/db/workshop_models.py`
- **Status**: Active

### MODEL-146: ServiceReminder

- **Table**: service_reminders
- **File**: `apps/backend/src/db/workshop_models.py`
- **Status**: Active

### MODEL-147: EquipmentServiceHistory

- **Table**: equipment_service_history
- **File**: `apps/backend/src/db/workshop_models.py`
- **Status**: Active

---

## Equipment Lifecycle Models (equipment_lifecycle_models.py) — Sprint 2

### MODEL-148: EquipmentUnit

- **Table**: equipment_units
- **File**: `apps/backend/src/db/equipment_lifecycle_models.py`
- **Key Fields**: serial_number (unique), product_id FK, customer_id FK, order_id FK, warranty_expiry, warranty_months, is_active
- **Migration**: `00c_equipment_lifecycle`
- **Status**: Active

### MODEL-149: WarrantyAlert

- **Table**: warranty_alerts
- **File**: `apps/backend/src/db/equipment_lifecycle_models.py`
- **Key Fields**: unit_id FK, alert_type, alert_date, resolved, resolved_at
- **Migration**: `00c_equipment_lifecycle`
- **Status**: Active

---

## Certification Models (certification_models.py) — Sprint 2

### MODEL-150: TechnicianCertification

- **Table**: technician_certifications
- **File**: `apps/backend/src/db/certification_models.py`
- **Key Fields**: customer_id FK, cert_body, cert_type, cert_number, technician_name, issue_date, expiry_date, status
- **Migration**: `00d_add_certification_tables`
- **Status**: Active

### MODEL-151: CertificationAlert

- **Table**: certification_alerts
- **File**: `apps/backend/src/db/certification_models.py`
- **Key Fields**: cert_id FK, days_until_expiry, notified, notified_at
- **Migration**: `00d_add_certification_tables`
- **Status**: Active

---

## Pricing Tier Models (pricing_models.py) — Sprint 2

### MODEL-152: PricingTier

- **Table**: pricing_tiers
- **File**: `apps/backend/src/db/pricing_models.py`
- **Key Fields**: name (unique), discount_pct, min_annual_spend, description
- **Migration**: `00e_add_pricing_tier_tables`
- **Status**: Active

### MODEL-153: CustomerPricingAssignment

- **Table**: customer_pricing_assignments
- **File**: `apps/backend/src/db/pricing_models.py`
- **Key Fields**: customer_id FK (unique), tier_id FK, effective_date, notes
- **Migration**: `00e_add_pricing_tier_tables`
- **Status**: Active

---

## Composite Indexes (indexes.py)

- **File**: `apps/backend/src/db/indexes.py`
- **Registered**: Yes (imported in main.py)
- **Indexes**:
  - `ix_order_items_order_product` — order_items(order_id, product_id)
  - `ix_orders_customer_status` — orders(customer_id, status)
  - `ix_products_category_active` — products(category, is_active)
