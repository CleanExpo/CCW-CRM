# Models Catalog — CCW ERP/CRM Database

# Last Updated: 2026-03-03

# Total Models: 36

# Source: apps/backend/src/db/

# WARNING: demo_models.py is LOCKED — do not modify without explicit approval

---

## Core Models (demo_models.py — LOCKED)

### MODEL-001: Organization

- **Table**: organizations
- **File**: `apps/backend/src/db/demo_models.py` (LOCKED)
- **Fields**: id (UUID PK), name (unique), slug (unique), is_active (bool), created_at, updated_at
- **Relationships**: users (one-to-many, via FK on users table)
- **Domain**: Auth / Multi-tenancy
- **Status**: Active — SCHEMA LOCKED
- **Last Verified**: 2026-03-03

### MODEL-002: Product

- **Table**: products
- **File**: `apps/backend/src/db/demo_models.py` (LOCKED)
- **Fields**: id (UUID PK), organization_id (FK nullable), sku (unique), name, description, category (ProductCategory enum string), price (Numeric), cost (Numeric), stock (int), warehouse_location, embedding (Vector 1536 — pgvector), is_active, created_at, updated_at
- **Relationships**: order_items (one-to-many), quote_items (one-to-many), translations (one-to-many, cascade delete)
- **Enums**: ProductCategory: HEAVY_MACHINERY, HAND_TOOLS, POWER_TOOLS, SAFETY_EQUIPMENT, BUILDING_MATERIALS, ELECTRICAL, PLUMBING, ACCESSORIES
- **Domain**: Inventory / Catalog
- **Status**: Active — SCHEMA LOCKED
- **Last Verified**: 2026-03-03

### MODEL-003: Customer

- **Table**: customers
- **File**: `apps/backend/src/db/demo_models.py` (LOCKED)
- **Fields**: id (UUID PK), organization_id (FK nullable), customer_number (unique), company_name, contact_name, email, phone, address, city, state, postcode, xero_contact_id, xero_synced_at, is_active, created_at, updated_at
- **Relationships**: orders (one-to-many), quotes (one-to-many)
- **Domain**: CRM
- **Status**: Active — SCHEMA LOCKED
- **Last Verified**: 2026-03-03

### MODEL-004: Order

- **Table**: orders
- **File**: `apps/backend/src/db/demo_models.py` (LOCKED)
- **Fields**: id (UUID PK), organization_id (FK nullable), order_number (unique), customer_id (FK CASCADE), status (OrderStatus enum), total (Numeric), notes, xero_invoice_id, xero_synced_at, xero_sync_status, order_date, created_at, updated_at, fulfillment_location, tracking_number, carrier_name, shipped_date, estimated_delivery_date
- **Relationships**: customer (many-to-one), order_items (one-to-many cascade delete), shipments (one-to-many), activities (one-to-many cascade delete)
- **Enums**: OrderStatus: draft, pending, confirmed, processing, shipped, delivered, cancelled
- **Domain**: Orders
- **Status**: Active — SCHEMA LOCKED
- **Last Verified**: 2026-03-03

### MODEL-005: OrderItem

- **Table**: order_items
- **File**: `apps/backend/src/db/demo_models.py` (LOCKED)
- **Fields**: id (UUID PK), order_id (FK CASCADE), product_id (FK CASCADE), quantity (int), unit_price (Numeric), line_total (Numeric), created_at, updated_at
- **Relationships**: order (many-to-one), product (many-to-one)
- **Indexes**: ix_order_items_order_product (composite, from indexes.py)
- **Domain**: Orders
- **Status**: Active — SCHEMA LOCKED
- **Last Verified**: 2026-03-03

### MODEL-006: OrderActivity

- **Table**: order_activity
- **File**: `apps/backend/src/db/demo_models.py` (LOCKED)
- **Fields**: id (UUID PK), order_id (FK CASCADE), event_type, message, created_by, meta_data (JSON), created_at
- **Relationships**: order (many-to-one)
- **Domain**: Orders / Audit Trail
- **Status**: Active — SCHEMA LOCKED
- **Last Verified**: 2026-03-03

### MODEL-007: Quote

- **Table**: quotes
- **File**: `apps/backend/src/db/demo_models.py` (LOCKED)
- **Fields**: id (UUID PK), organization_id (FK nullable), quote_number (unique), customer_id (FK CASCADE), status (QuoteStatus enum), total (Numeric), notes, valid_until, quote_date, created_at, updated_at
- **Relationships**: customer (many-to-one), quote_items (one-to-many cascade delete)
- **Enums**: QuoteStatus: draft, pending, sent, accepted, rejected, expired
- **Domain**: Orders
- **Status**: Active — SCHEMA LOCKED
- **Last Verified**: 2026-03-03

### MODEL-008: QuoteItem

- **Table**: quote_items
- **File**: `apps/backend/src/db/demo_models.py` (LOCKED)
- **Fields**: id (UUID PK), quote_id (FK CASCADE), product_id (FK CASCADE), quantity (int), unit_price (Numeric), line_total (Numeric), created_at, updated_at
- **Relationships**: quote (many-to-one), product (many-to-one)
- **Domain**: Orders
- **Status**: Active — SCHEMA LOCKED
- **Last Verified**: 2026-03-03

### MODEL-009: ConversationHistory

- **Table**: conversation_history
- **File**: `apps/backend/src/db/demo_models.py` (LOCKED)
- **Fields**: id (UUID PK), conversation_id (UUID), role (user/assistant), content, user_id (UUID nullable), created_at
- **Domain**: AI / Chat
- **Status**: Active — SCHEMA LOCKED
- **Last Verified**: 2026-03-03

### MODEL-010: AgentExecution

- **Table**: agent_executions
- **File**: `apps/backend/src/db/demo_models.py` (LOCKED)
- **Fields**: id (UUID PK), agent_id, agent_name, task, context_snapshot, status, result, error, execution_time_ms, tokens_used, estimated_cost_usd, initiated_by, parent_execution_id (UUID nullable), user_id (UUID nullable), created_at, completed_at
- **Domain**: AI / Audit Trail
- **Status**: Active — SCHEMA LOCKED
- **Last Verified**: 2026-03-03

### MODEL-011: AIGeneratedContent

- **Table**: ai_generated_content
- **File**: `apps/backend/src/db/demo_models.py` (LOCKED)
- **Fields**: id (UUID PK), content_type, title, content, content_metadata, entity_type, entity_id (UUID nullable), user_id (UUID nullable), created_at
- **Domain**: AI / Content
- **Status**: Active — SCHEMA LOCKED
- **Last Verified**: 2026-03-03

### MODEL-012: BackgroundJob

- **Table**: background_jobs
- **File**: `apps/backend/src/db/demo_models.py` (LOCKED)
- **Fields**: id (UUID PK), job_type, status (JobStatus enum), input_data (JSON), output_data (JSON), progress (0–100), error_message, created_at, updated_at, started_at, completed_at
- **Enums**: JobStatus: pending, processing, completed, failed, cancelled
- **Domain**: Infrastructure / Background Processing
- **Status**: Active — SCHEMA LOCKED
- **Last Verified**: 2026-03-03

---

## Cin7 Integration Models (cin7_models.py)

### MODEL-013: Cin7Connection

- **Table**: cin7_connections
- **File**: `apps/backend/src/db/cin7_models.py`
- **Fields**: id (UUID PK), organization_id (UUID nullable), account_name (unique), connection_type (core/omni/both), core_account_id, core_application_key, omni_username, omni_api_key, is_active, last_sync_at, last_product_sync_at, last_customer_sync_at, last_inventory_sync_at, sync_settings (JSONB), created_at, updated_at
- **Domain**: Integration / Cin7
- **Status**: Active
- **Last Verified**: 2026-03-03

### MODEL-014: Cin7ProductMapping

- **Table**: cin7_product_mappings
- **File**: `apps/backend/src/db/cin7_models.py`
- **Fields**: id (UUID PK), product_id (UUID FK-like), cin7_core_product_id, cin7_omni_product_id (int), cin7_sku, last_synced_at, sync_status, created_at, updated_at
- **Domain**: Integration / Cin7
- **Status**: Active
- **Last Verified**: 2026-03-03

### MODEL-015: Cin7CustomerMapping

- **Table**: cin7_customer_mappings
- **File**: `apps/backend/src/db/cin7_models.py`
- **Fields**: id (UUID PK), customer_id (UUID), cin7_core_customer_id, cin7_omni_contact_id (int), cin7_customer_name, last_synced_at, sync_status, created_at, updated_at
- **Domain**: Integration / Cin7
- **Status**: Active
- **Last Verified**: 2026-03-03

### MODEL-016: Cin7OrderMapping

- **Table**: cin7_order_mappings
- **File**: `apps/backend/src/db/cin7_models.py`
- **Fields**: id (UUID PK), order_id (UUID), cin7_core_sale_id, cin7_omni_order_id (int), cin7_order_number, last_synced_at, sync_status, created_at, updated_at
- **Domain**: Integration / Cin7
- **Status**: Active
- **Last Verified**: 2026-03-03

### MODEL-017: Cin7QuoteMapping

- **Table**: cin7_quote_mappings
- **File**: `apps/backend/src/db/cin7_models.py`
- **Fields**: id (UUID PK), quote_id (UUID), cin7_omni_quote_id (int, Omni-only — Core has no quotes API), cin7_quote_reference, last_synced_at, sync_status, created_at, updated_at
- **Domain**: Integration / Cin7
- **Status**: Active
- **Last Verified**: 2026-03-03

### MODEL-018: Cin7SupplierMapping

- **Table**: cin7_supplier_mappings
- **File**: `apps/backend/src/db/cin7_models.py`
- **Fields**: id (UUID PK), supplier_id (UUID), cin7_core_supplier_id, cin7_omni_supplier_id (int), cin7_supplier_name, last_synced_at, sync_status, created_at, updated_at
- **Domain**: Integration / Cin7
- **Status**: Active
- **Last Verified**: 2026-03-03

### MODEL-019: Cin7PurchaseOrderMapping

- **Table**: cin7_purchase_order_mappings
- **File**: `apps/backend/src/db/cin7_models.py`
- **Fields**: id (UUID PK), purchase_order_id (UUID), cin7_core_purchase_id, cin7_omni_po_id (int), cin7_po_number, last_synced_at, sync_status, created_at, updated_at
- **Domain**: Integration / Cin7
- **Status**: Active
- **Last Verified**: 2026-03-03

### MODEL-020: Cin7SyncLog

- **Table**: cin7_sync_logs
- **File**: `apps/backend/src/db/cin7_models.py`
- **Fields**: id (UUID PK), connection_id (UUID nullable FK), sync_type (products/customers/sales/inventory), direction (SyncDirection enum), api_source (core/omni), status (SyncStatus enum), records_processed, records_created, records_updated, records_failed, error_message, details (JSONB), started_at, completed_at
- **Enums**: SyncDirection: cin7_to_erp, erp_to_cin7, bidirectional; SyncStatus: pending, in_progress, completed, failed, partial
- **Domain**: Integration / Cin7 / Audit
- **Status**: Active
- **Last Verified**: 2026-03-03

---

## POS Models (pos_models.py)

### MODEL-021: Location

- **Table**: locations
- **File**: `apps/backend/src/db/pos_models.py`
- **Fields**: id (UUID PK), code (unique), name, location_type (physical/virtual), address, city, state, postal_code, country (default Australia), timezone (default Australia/Brisbane), is_active, created_at, updated_at
- **Relationships**: sales_staff (one-to-many), pos_terminals (one-to-many), bank_accounts (one-to-many), pos_transactions (one-to-many via location_code and resolved_location_code)
- **Domain**: POS / Multi-Location
- **Status**: Active
- **Last Verified**: 2026-03-03

### MODEL-022: SalesStaff

- **Table**: sales_staff
- **File**: `apps/backend/src/db/pos_models.py`
- **Fields**: id (UUID PK), staff_code (unique), full_name, email, phone, primary_location_code (FK to locations), can_sell_at_locations (Array of strings), is_active, created_at, updated_at
- **Relationships**: primary_location (many-to-one), pos_transactions (one-to-many)
- **Domain**: POS / HR
- **Status**: Active
- **Last Verified**: 2026-03-03

### MODEL-023: POSTerminal

- **Table**: pos_terminals
- **File**: `apps/backend/src/db/pos_models.py`
- **Fields**: id (UUID PK), terminal_id (unique), location_code (FK), terminal_type (eftpos/amex/virtual), merchant_id, terminal_config (JSONB), is_active, last_ping_at, created_at, updated_at
- **Relationships**: location (many-to-one), pos_transactions (one-to-many)
- **Domain**: POS
- **Status**: Active
- **Last Verified**: 2026-03-03

### MODEL-024: BankAccount

- **Table**: bank_accounts
- **File**: `apps/backend/src/db/pos_models.py`
- **Fields**: id (UUID PK), account_name, account_number, bsb, bank_name, location_code (FK nullable), account_type (checking/savings/merchant), currency (default AUD), feed_provider, feed_account_id, last_feed_sync_at, feed_sync_status, sync_interval_hours, webhook_enabled, webhook_secret, sync_retry_count, last_sync_error, is_active, created_at, updated_at
- **Relationships**: location (many-to-one nullable), bank_feeds (one-to-many cascade delete)
- **Domain**: Financial / POS / Bank Feeds
- **Status**: Active
- **Last Verified**: 2026-03-03

### MODEL-025: POSTransaction

- **Table**: pos_transactions
- **File**: `apps/backend/src/db/pos_models.py`
- **Fields**: id (UUID PK), transaction_number (unique), order_id (FK nullable), terminal_id (FK nullable), sales_staff_id (FK nullable), location_code (FK), resolved_location_code (FK nullable), transaction_type (sale/refund/void), payment_method (eftpos/amex/bank_transfer/cash), amount (Numeric), currency (AUD), payment_status (pending/authorized/captured/failed/refunded), payment_gateway_ref, payment_gateway_response (JSONB), bank_statement_ref, xero_invoice_id, cin7_transaction_id, reconciliation_status (pending/matched/discrepancy/resolved), reconciled_at, reconciled_by, created_at, updated_at
- **Relationships**: terminal, sales_staff, location, resolved_location, bank_feeds
- **Domain**: Financial / POS
- **Status**: Active
- **Last Verified**: 2026-03-03

### MODEL-026: BankFeed

- **Table**: bank_feeds
- **File**: `apps/backend/src/db/pos_models.py`
- **Fields**: id (UUID PK), bank_account_id (FK CASCADE), transaction_date, description, reference, debit (Numeric), credit (Numeric), balance (Numeric), matched_pos_transaction_id (FK nullable), match_confidence (Numeric 0–1), match_status (pending/auto_matched/manual_matched/no_match), matched_at, matched_by, raw_data (JSONB), match_suggestions (JSONB array), created_at, updated_at
- **Relationships**: bank_account (many-to-one), matched_pos_transaction (many-to-one nullable)
- **Domain**: Financial / Reconciliation
- **Status**: Active
- **Last Verified**: 2026-03-03

---

## Webhook Models (webhook_models.py)

### MODEL-027: WebhookEvent

- **Table**: webhook_events
- **File**: `apps/backend/src/db/webhook_models.py`
- **Fields**: id (UUID PK), source (shopify/xero/sendgrid/stripe/fedex/ups/usps/contact_form/demo_request/cin7/other), event_type, event_id (idempotency key), payload (JSON), headers (JSON nullable), status (WebhookStatus enum), retry_count, max_retries (default 3), next_retry_at (nullable), error_message, error_details (JSON), processing_result (JSON), received_at, started_processing_at, completed_at
- **Indexes**: ix_webhook_events_source_event_id (unique composite — idempotency), ix_webhook_events_status_next_retry (for retry polling)
- **Enums**: WebhookStatus: pending, processing, completed, failed, dead_letter; WebhookSource: shopify, xero, sendgrid, stripe, fedex, ups, usps, contact_form, demo_request, cin7, other
- **Domain**: Integration / Webhooks / Event Processing
- **Status**: Active
- **Last Verified**: 2026-03-03

### MODEL-028: WebhookMetrics

- **Table**: webhook_metrics
- **File**: `apps/backend/src/db/webhook_models.py`
- **Fields**: id (UUID PK), period_type (hourly/daily/weekly), period_start, period_end, source, total_received, total_completed, total_failed, total_dead_letter, avg_processing_time_ms, max_processing_time_ms, reliability_rate (float), calculated_at
- **Indexes**: ix_webhook_metrics_source_period (unique composite)
- **Domain**: Monitoring / Webhooks
- **Status**: Active
- **Last Verified**: 2026-03-03

---

## Additional DB Model Files (inferred from db/ directory listing)

### MODEL-029: i18n / ProductTranslation (i18n_models.py)

- **File**: `apps/backend/src/db/i18n_models.py`
- **Domain**: i18n / Translations
- **Notes**: ProductTranslation model for 10-language support; imported by demo_models.py
- **Status**: Active

### MODEL-030: Inventory / OutboundShipment (inventory_models.py)

- **File**: `apps/backend/src/db/inventory_models.py`
- **Domain**: Inventory / Logistics
- **Notes**: Multi-location inventory tracking, OutboundShipment; imported by demo_models.py
- **Status**: Active

### MODEL-031: CRM Models (crm_models.py)

- **File**: `apps/backend/src/db/crm_models.py`
- **Domain**: CRM / Contacts / Activities
- **Notes**: Contact, Activity, ServiceRequest models
- **Status**: Active

### MODEL-032: AP2 Models (ap2_models.py)

- **File**: `apps/backend/src/db/ap2_models.py`
- **Domain**: Integration / Google AP2 Payments
- **Status**: Active

### MODEL-033: Approvals Models (approvals_models.py)

- **File**: `apps/backend/src/db/approvals_models.py`
- **Domain**: Workflow / Approvals
- **Status**: Active

### MODEL-034: Container Models (container_models.py)

- **File**: `apps/backend/src/db/container_models.py`
- **Domain**: Logistics / Container Tracking
- **Status**: Active

### MODEL-035: Email Audit Models (email_audit_models.py)

- **File**: `apps/backend/src/db/email_audit_models.py`
- **Domain**: GDPR Compliance / Email Audit (ISS-037)
- **Status**: Active

### MODEL-036: Shopify Models (shopify_models.py + shopify_extended_models.py)

- **File**: `apps/backend/src/db/shopify_models.py`, `apps/backend/src/db/shopify_extended_models.py`
- **Domain**: Integration / Shopify
- **Status**: Active

### MODEL-037: Xero Models (xero_models.py)

- **File**: `apps/backend/src/db/xero_models.py`
- **Domain**: Integration / Xero
- **Status**: Active

### MODEL-038: Portal Forms Models (portal_forms_models.py)

- **File**: `apps/backend/src/db/portal_forms_models.py`
- **Domain**: Customer Portal / Forms
- **Status**: Active

### MODEL-039: AI Search Models (ai_search_models.py)

- **File**: `apps/backend/src/db/ai_search_models.py`
- **Domain**: AI / Search
- **Status**: Active

### MODEL-040: Service Models (service_models.py)

- **File**: `apps/backend/src/db/service_models.py`
- **Domain**: CRM / Service Requests
- **Status**: Active

---

## Composite Indexes (indexes.py)

- **File**: `apps/backend/src/db/indexes.py`
- **Registered**: Yes (imported in main.py with noqa comment)
- **Indexes**:
  - `ix_order_items_order_product` — order_items(order_id, product_id) — accelerates order line-item lookups (UNI-1231)
  - `ix_orders_customer_status` — orders(customer_id, status) — accelerates customer order filtering (UNI-1231)
  - `ix_products_category_active` — products(category, is_active) — accelerates catalog browsing by category (UNI-1231)
