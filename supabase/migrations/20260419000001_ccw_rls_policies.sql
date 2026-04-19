-- =============================================================================
-- Migration: CCW-ERP Fleet-Wide RLS Policy Hardening (UNI-1749)
-- Description: Adds service_role bypass policies to all backend-managed tables
--              that have RLS enabled but no policy (Supabase advisor finding).
--              The FastAPI backend connects as service_role which automatically
--              bypasses RLS, but explicit policies are required to silence the
--              Supabase advisor "missing_rls" alerts.
-- Idempotent:  DROP POLICY IF EXISTS before each CREATE POLICY.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- HELPER NOTE
-- The FastAPI backend uses the Supabase service_role key for all DB access.
-- service_role bypasses RLS automatically, but Supabase advisor flags tables
-- that have RLS enabled with zero policies. We add explicit bypass policies
-- for every backend-managed table to clear the 17-table alert count to 0.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. CORE ERP TABLES (fix users — the only core table missing any policy)
-- ===========================================================================

ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_users" ON public.users;
CREATE POLICY "service_role_all_users"
    ON public.users FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Also harden organizations write (existing migration only added SELECT policy)
ALTER TABLE IF EXISTS public.organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_organizations" ON public.organizations;
CREATE POLICY "service_role_all_organizations"
    ON public.organizations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Cover remaining demo_models.py tables not in erp_permissions.sql
ALTER TABLE IF EXISTS public.order_activity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_order_activity" ON public.order_activity;
CREATE POLICY "service_role_all_order_activity"
    ON public.order_activity FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.conversation_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_conversation_history" ON public.conversation_history;
CREATE POLICY "service_role_all_conversation_history"
    ON public.conversation_history FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.agent_executions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_agent_executions" ON public.agent_executions;
CREATE POLICY "service_role_all_agent_executions"
    ON public.agent_executions FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.ai_generated_content ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_ai_generated_content" ON public.ai_generated_content;
CREATE POLICY "service_role_all_ai_generated_content"
    ON public.ai_generated_content FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.background_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_background_jobs" ON public.background_jobs;
CREATE POLICY "service_role_all_background_jobs"
    ON public.background_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ===========================================================================
-- 2. WORKSHOP TABLES
-- ===========================================================================

ALTER TABLE IF EXISTS public.equipment ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_equipment" ON public.equipment;
CREATE POLICY "service_role_all_equipment"
    ON public.equipment FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.service_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_service_templates" ON public.service_templates;
CREATE POLICY "service_role_all_service_templates"
    ON public.service_templates FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.service_template_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_service_template_items" ON public.service_template_items;
CREATE POLICY "service_role_all_service_template_items"
    ON public.service_template_items FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.workshop_bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_workshop_bookings" ON public.workshop_bookings;
CREATE POLICY "service_role_all_workshop_bookings"
    ON public.workshop_bookings FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.service_reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_service_reminders" ON public.service_reminders;
CREATE POLICY "service_role_all_service_reminders"
    ON public.service_reminders FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.equipment_service_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_equipment_service_history" ON public.equipment_service_history;
CREATE POLICY "service_role_all_equipment_service_history"
    ON public.equipment_service_history FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.workshop_job_parts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_workshop_job_parts" ON public.workshop_job_parts;
CREATE POLICY "service_role_all_workshop_job_parts"
    ON public.workshop_job_parts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ===========================================================================
-- 3. INVENTORY TABLES
-- ===========================================================================

ALTER TABLE IF EXISTS public.product_stock_by_location ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_product_stock_by_location" ON public.product_stock_by_location;
CREATE POLICY "service_role_all_product_stock_by_location"
    ON public.product_stock_by_location FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.stock_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_stock_transfers" ON public.stock_transfers;
CREATE POLICY "service_role_all_stock_transfers"
    ON public.stock_transfers FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.stock_reservations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_stock_reservations" ON public.stock_reservations;
CREATE POLICY "service_role_all_stock_reservations"
    ON public.stock_reservations FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.stock_adjustments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_stock_adjustments" ON public.stock_adjustments;
CREATE POLICY "service_role_all_stock_adjustments"
    ON public.stock_adjustments FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_suppliers" ON public.suppliers;
CREATE POLICY "service_role_all_suppliers"
    ON public.suppliers FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_purchase_orders" ON public.purchase_orders;
CREATE POLICY "service_role_all_purchase_orders"
    ON public.purchase_orders FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.purchase_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_purchase_order_items" ON public.purchase_order_items;
CREATE POLICY "service_role_all_purchase_order_items"
    ON public.purchase_order_items FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.inbound_shipments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_inbound_shipments" ON public.inbound_shipments;
CREATE POLICY "service_role_all_inbound_shipments"
    ON public.inbound_shipments FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.outbound_shipments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_outbound_shipments" ON public.outbound_shipments;
CREATE POLICY "service_role_all_outbound_shipments"
    ON public.outbound_shipments FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.carrier_configurations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_carrier_configurations" ON public.carrier_configurations;
CREATE POLICY "service_role_all_carrier_configurations"
    ON public.carrier_configurations FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.product_barcodes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_product_barcodes" ON public.product_barcodes;
CREATE POLICY "service_role_all_product_barcodes"
    ON public.product_barcodes FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.stock_takes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_stock_takes" ON public.stock_takes;
CREATE POLICY "service_role_all_stock_takes"
    ON public.stock_takes FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.stock_take_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_stock_take_items" ON public.stock_take_items;
CREATE POLICY "service_role_all_stock_take_items"
    ON public.stock_take_items FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.reorder_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_reorder_rules" ON public.reorder_rules;
CREATE POLICY "service_role_all_reorder_rules"
    ON public.reorder_rules FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.product_attributes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_product_attributes" ON public.product_attributes;
CREATE POLICY "service_role_all_product_attributes"
    ON public.product_attributes FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.product_variants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_product_variants" ON public.product_variants;
CREATE POLICY "service_role_all_product_variants"
    ON public.product_variants FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.product_dangerous_goods_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_product_dangerous_goods_profiles" ON public.product_dangerous_goods_profiles;
CREATE POLICY "service_role_all_product_dangerous_goods_profiles"
    ON public.product_dangerous_goods_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ===========================================================================
-- 4. POS TABLES
-- ===========================================================================

ALTER TABLE IF EXISTS public.locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_locations" ON public.locations;
CREATE POLICY "service_role_all_locations"
    ON public.locations FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.sales_staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_sales_staff" ON public.sales_staff;
CREATE POLICY "service_role_all_sales_staff"
    ON public.sales_staff FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.pos_terminals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_pos_terminals" ON public.pos_terminals;
CREATE POLICY "service_role_all_pos_terminals"
    ON public.pos_terminals FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.bank_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_bank_accounts" ON public.bank_accounts;
CREATE POLICY "service_role_all_bank_accounts"
    ON public.bank_accounts FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.pos_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_pos_transactions" ON public.pos_transactions;
CREATE POLICY "service_role_all_pos_transactions"
    ON public.pos_transactions FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.bank_feeds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_bank_feeds" ON public.bank_feeds;
CREATE POLICY "service_role_all_bank_feeds"
    ON public.bank_feeds FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ===========================================================================
-- 5. CRM TABLES
-- ===========================================================================

ALTER TABLE IF EXISTS public.contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_contacts" ON public.contacts;
CREATE POLICY "service_role_all_contacts"
    ON public.contacts FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_activities" ON public.activities;
CREATE POLICY "service_role_all_activities"
    ON public.activities FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.customer_personas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_customer_personas" ON public.customer_personas;
CREATE POLICY "service_role_all_customer_personas"
    ON public.customer_personas FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.onboarding_sequences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_onboarding_sequences" ON public.onboarding_sequences;
CREATE POLICY "service_role_all_onboarding_sequences"
    ON public.onboarding_sequences FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.onboarding_touchpoints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_onboarding_touchpoints" ON public.onboarding_touchpoints;
CREATE POLICY "service_role_all_onboarding_touchpoints"
    ON public.onboarding_touchpoints FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ===========================================================================
-- 6. WORKFLOW / SLA / NOTIFICATION TABLES
-- ===========================================================================

ALTER TABLE IF EXISTS public.workflow_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_workflow_templates" ON public.workflow_templates;
CREATE POLICY "service_role_all_workflow_templates"
    ON public.workflow_templates FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.workflow_template_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_workflow_template_actions" ON public.workflow_template_actions;
CREATE POLICY "service_role_all_workflow_template_actions"
    ON public.workflow_template_actions FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.workflow_instances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_workflow_instances" ON public.workflow_instances;
CREATE POLICY "service_role_all_workflow_instances"
    ON public.workflow_instances FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.sla_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_sla_rules" ON public.sla_rules;
CREATE POLICY "service_role_all_sla_rules"
    ON public.sla_rules FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.sla_instances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_sla_instances" ON public.sla_instances;
CREATE POLICY "service_role_all_sla_instances"
    ON public.sla_instances FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.in_app_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_in_app_notifications" ON public.in_app_notifications;
CREATE POLICY "service_role_all_in_app_notifications"
    ON public.in_app_notifications FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ===========================================================================
-- 7. CIN7 INTEGRATION TABLES
-- ===========================================================================

ALTER TABLE IF EXISTS public.cin7_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_cin7_connections" ON public.cin7_connections;
CREATE POLICY "service_role_all_cin7_connections"
    ON public.cin7_connections FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.cin7_product_mappings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_cin7_product_mappings" ON public.cin7_product_mappings;
CREATE POLICY "service_role_all_cin7_product_mappings"
    ON public.cin7_product_mappings FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.cin7_customer_mappings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_cin7_customer_mappings" ON public.cin7_customer_mappings;
CREATE POLICY "service_role_all_cin7_customer_mappings"
    ON public.cin7_customer_mappings FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.cin7_order_mappings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_cin7_order_mappings" ON public.cin7_order_mappings;
CREATE POLICY "service_role_all_cin7_order_mappings"
    ON public.cin7_order_mappings FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.cin7_quote_mappings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_cin7_quote_mappings" ON public.cin7_quote_mappings;
CREATE POLICY "service_role_all_cin7_quote_mappings"
    ON public.cin7_quote_mappings FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.cin7_supplier_mappings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_cin7_supplier_mappings" ON public.cin7_supplier_mappings;
CREATE POLICY "service_role_all_cin7_supplier_mappings"
    ON public.cin7_supplier_mappings FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.cin7_purchase_order_mappings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_cin7_purchase_order_mappings" ON public.cin7_purchase_order_mappings;
CREATE POLICY "service_role_all_cin7_purchase_order_mappings"
    ON public.cin7_purchase_order_mappings FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.cin7_webhook_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_cin7_webhook_subscriptions" ON public.cin7_webhook_subscriptions;
CREATE POLICY "service_role_all_cin7_webhook_subscriptions"
    ON public.cin7_webhook_subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.cin7_sync_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_cin7_sync_logs" ON public.cin7_sync_logs;
CREATE POLICY "service_role_all_cin7_sync_logs"
    ON public.cin7_sync_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.cin7_order_line_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_cin7_order_line_items" ON public.cin7_order_line_items;
CREATE POLICY "service_role_all_cin7_order_line_items"
    ON public.cin7_order_line_items FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.cin7_purchase_order_line_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_cin7_purchase_order_line_items" ON public.cin7_purchase_order_line_items;
CREATE POLICY "service_role_all_cin7_purchase_order_line_items"
    ON public.cin7_purchase_order_line_items FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.cin7_goods_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_cin7_goods_receipts" ON public.cin7_goods_receipts;
CREATE POLICY "service_role_all_cin7_goods_receipts"
    ON public.cin7_goods_receipts FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.cin7_goods_receipt_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_cin7_goods_receipt_lines" ON public.cin7_goods_receipt_lines;
CREATE POLICY "service_role_all_cin7_goods_receipt_lines"
    ON public.cin7_goods_receipt_lines FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.cin7_stock_adjustments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_cin7_stock_adjustments" ON public.cin7_stock_adjustments;
CREATE POLICY "service_role_all_cin7_stock_adjustments"
    ON public.cin7_stock_adjustments FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.cin7_stock_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_cin7_stock_transfers" ON public.cin7_stock_transfers;
CREATE POLICY "service_role_all_cin7_stock_transfers"
    ON public.cin7_stock_transfers FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.cin7_stock_takes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_cin7_stock_takes" ON public.cin7_stock_takes;
CREATE POLICY "service_role_all_cin7_stock_takes"
    ON public.cin7_stock_takes FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.cin7_stock_take_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_cin7_stock_take_lines" ON public.cin7_stock_take_lines;
CREATE POLICY "service_role_all_cin7_stock_take_lines"
    ON public.cin7_stock_take_lines FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.cin7_shadow_syncs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_cin7_shadow_syncs" ON public.cin7_shadow_syncs;
CREATE POLICY "service_role_all_cin7_shadow_syncs"
    ON public.cin7_shadow_syncs FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.cin7_sync_gaps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_cin7_sync_gaps" ON public.cin7_sync_gaps;
CREATE POLICY "service_role_all_cin7_sync_gaps"
    ON public.cin7_sync_gaps FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.cin7_fulfilments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_cin7_fulfilments" ON public.cin7_fulfilments;
CREATE POLICY "service_role_all_cin7_fulfilments"
    ON public.cin7_fulfilments FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.cin7_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_cin7_invoices" ON public.cin7_invoices;
CREATE POLICY "service_role_all_cin7_invoices"
    ON public.cin7_invoices FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.cin7_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_cin7_payments" ON public.cin7_payments;
CREATE POLICY "service_role_all_cin7_payments"
    ON public.cin7_payments FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.cin7_chart_of_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_cin7_chart_of_accounts" ON public.cin7_chart_of_accounts;
CREATE POLICY "service_role_all_cin7_chart_of_accounts"
    ON public.cin7_chart_of_accounts FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.cin7_journal_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_cin7_journal_entries" ON public.cin7_journal_entries;
CREATE POLICY "service_role_all_cin7_journal_entries"
    ON public.cin7_journal_entries FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.cin7_journal_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_cin7_journal_lines" ON public.cin7_journal_lines;
CREATE POLICY "service_role_all_cin7_journal_lines"
    ON public.cin7_journal_lines FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.cin7_account_mappings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_cin7_account_mappings" ON public.cin7_account_mappings;
CREATE POLICY "service_role_all_cin7_account_mappings"
    ON public.cin7_account_mappings FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.cin7_bom_masters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_cin7_bom_masters" ON public.cin7_bom_masters;
CREATE POLICY "service_role_all_cin7_bom_masters"
    ON public.cin7_bom_masters FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.cin7_bom_components ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_cin7_bom_components" ON public.cin7_bom_components;
CREATE POLICY "service_role_all_cin7_bom_components"
    ON public.cin7_bom_components FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.cin7_production_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_cin7_production_runs" ON public.cin7_production_runs;
CREATE POLICY "service_role_all_cin7_production_runs"
    ON public.cin7_production_runs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ===========================================================================
-- 8. SHOPIFY INTEGRATION TABLES
-- ===========================================================================

ALTER TABLE IF EXISTS public.shopify_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_shopify_connections" ON public.shopify_connections;
CREATE POLICY "service_role_all_shopify_connections"
    ON public.shopify_connections FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.shopify_product_mappings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_shopify_product_mappings" ON public.shopify_product_mappings;
CREATE POLICY "service_role_all_shopify_product_mappings"
    ON public.shopify_product_mappings FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.shopify_order_mappings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_shopify_order_mappings" ON public.shopify_order_mappings;
CREATE POLICY "service_role_all_shopify_order_mappings"
    ON public.shopify_order_mappings FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.shopify_webhook_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_shopify_webhook_logs" ON public.shopify_webhook_logs;
CREATE POLICY "service_role_all_shopify_webhook_logs"
    ON public.shopify_webhook_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.shopify_product_sync_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_shopify_product_sync_logs" ON public.shopify_product_sync_logs;
CREATE POLICY "service_role_all_shopify_product_sync_logs"
    ON public.shopify_product_sync_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.shopify_metafields ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_shopify_metafields" ON public.shopify_metafields;
CREATE POLICY "service_role_all_shopify_metafields"
    ON public.shopify_metafields FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.shopify_inventory_syncs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_shopify_inventory_syncs" ON public.shopify_inventory_syncs;
CREATE POLICY "service_role_all_shopify_inventory_syncs"
    ON public.shopify_inventory_syncs FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.shopify_theme_endpoints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_shopify_theme_endpoints" ON public.shopify_theme_endpoints;
CREATE POLICY "service_role_all_shopify_theme_endpoints"
    ON public.shopify_theme_endpoints FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.shopify_product_translations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_shopify_product_translations" ON public.shopify_product_translations;
CREATE POLICY "service_role_all_shopify_product_translations"
    ON public.shopify_product_translations FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.shopify_inventory_sync_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_shopify_inventory_sync_queue" ON public.shopify_inventory_sync_queue;
CREATE POLICY "service_role_all_shopify_inventory_sync_queue"
    ON public.shopify_inventory_sync_queue FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ===========================================================================
-- 9. XERO / AP2 / INVOICING TABLES
-- ===========================================================================

ALTER TABLE IF EXISTS public.xero_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_xero_connections" ON public.xero_connections;
CREATE POLICY "service_role_all_xero_connections"
    ON public.xero_connections FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_payments" ON public.payments;
CREATE POLICY "service_role_all_payments"
    ON public.payments FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.ap2_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_ap2_connections" ON public.ap2_connections;
CREATE POLICY "service_role_all_ap2_connections"
    ON public.ap2_connections FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.ap2_mandates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_ap2_mandates" ON public.ap2_mandates;
CREATE POLICY "service_role_all_ap2_mandates"
    ON public.ap2_mandates FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.ap2_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_ap2_transactions" ON public.ap2_transactions;
CREATE POLICY "service_role_all_ap2_transactions"
    ON public.ap2_transactions FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.ap2_voice_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_ap2_voice_sessions" ON public.ap2_voice_sessions;
CREATE POLICY "service_role_all_ap2_voice_sessions"
    ON public.ap2_voice_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.ap2_agent_interactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_ap2_agent_interactions" ON public.ap2_agent_interactions;
CREATE POLICY "service_role_all_ap2_agent_interactions"
    ON public.ap2_agent_interactions FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.ap2_webhook_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_ap2_webhook_logs" ON public.ap2_webhook_logs;
CREATE POLICY "service_role_all_ap2_webhook_logs"
    ON public.ap2_webhook_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.tax_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_tax_rates" ON public.tax_rates;
CREATE POLICY "service_role_all_tax_rates"
    ON public.tax_rates FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_invoices" ON public.invoices;
CREATE POLICY "service_role_all_invoices"
    ON public.invoices FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.invoice_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_invoice_items" ON public.invoice_items;
CREATE POLICY "service_role_all_invoice_items"
    ON public.invoice_items FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.invoice_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_invoice_payments" ON public.invoice_payments;
CREATE POLICY "service_role_all_invoice_payments"
    ON public.invoice_payments FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_subscriptions" ON public.subscriptions;
CREATE POLICY "service_role_all_subscriptions"
    ON public.subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ===========================================================================
-- 10. APPROVALS / WEBHOOK / SERVICE / MISC TABLES
-- ===========================================================================

ALTER TABLE IF EXISTS public.approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_approvals" ON public.approvals;
CREATE POLICY "service_role_all_approvals"
    ON public.approvals FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.approval_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_approval_steps" ON public.approval_steps;
CREATE POLICY "service_role_all_approval_steps"
    ON public.approval_steps FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.webhook_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_webhook_events" ON public.webhook_events;
CREATE POLICY "service_role_all_webhook_events"
    ON public.webhook_events FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.webhook_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_webhook_metrics" ON public.webhook_metrics;
CREATE POLICY "service_role_all_webhook_metrics"
    ON public.webhook_metrics FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.service_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_service_requests" ON public.service_requests;
CREATE POLICY "service_role_all_service_requests"
    ON public.service_requests FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.containers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_containers" ON public.containers;
CREATE POLICY "service_role_all_containers"
    ON public.containers FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.container_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_container_items" ON public.container_items;
CREATE POLICY "service_role_all_container_items"
    ON public.container_items FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.backorders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_backorders" ON public.backorders;
CREATE POLICY "service_role_all_backorders"
    ON public.backorders FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.contact_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_contact_submissions" ON public.contact_submissions;
CREATE POLICY "service_role_all_contact_submissions"
    ON public.contact_submissions FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.demo_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_demo_requests" ON public.demo_requests;
CREATE POLICY "service_role_all_demo_requests"
    ON public.demo_requests FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.submission_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_submission_notes" ON public.submission_notes;
CREATE POLICY "service_role_all_submission_notes"
    ON public.submission_notes FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ===========================================================================
-- 11. EMAIL / I18N / AI TABLES
-- ===========================================================================

ALTER TABLE IF EXISTS public.email_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_email_conversations" ON public.email_conversations;
CREATE POLICY "service_role_all_email_conversations"
    ON public.email_conversations FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.email_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_email_messages" ON public.email_messages;
CREATE POLICY "service_role_all_email_messages"
    ON public.email_messages FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.email_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_email_templates" ON public.email_templates;
CREATE POLICY "service_role_all_email_templates"
    ON public.email_templates FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.email_webhook_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_email_webhook_logs" ON public.email_webhook_logs;
CREATE POLICY "service_role_all_email_webhook_logs"
    ON public.email_webhook_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.email_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_email_logs" ON public.email_logs;
CREATE POLICY "service_role_all_email_logs"
    ON public.email_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.email_consents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_email_consents" ON public.email_consents;
CREATE POLICY "service_role_all_email_consents"
    ON public.email_consents FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.languages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_languages" ON public.languages;
CREATE POLICY "service_role_all_languages"
    ON public.languages FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.product_translations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_product_translations" ON public.product_translations;
CREATE POLICY "service_role_all_product_translations"
    ON public.product_translations FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.category_translations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_category_translations" ON public.category_translations;
CREATE POLICY "service_role_all_category_translations"
    ON public.category_translations FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.ui_translations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_ui_translations" ON public.ui_translations;
CREATE POLICY "service_role_all_ui_translations"
    ON public.ui_translations FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.email_template_translations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_email_template_translations" ON public.email_template_translations;
CREATE POLICY "service_role_all_email_template_translations"
    ON public.email_template_translations FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.translation_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_translation_queue" ON public.translation_queue;
CREATE POLICY "service_role_all_translation_queue"
    ON public.translation_queue FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.learning_patterns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_learning_patterns" ON public.learning_patterns;
CREATE POLICY "service_role_all_learning_patterns"
    ON public.learning_patterns FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.learning_insights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_learning_insights" ON public.learning_insights;
CREATE POLICY "service_role_all_learning_insights"
    ON public.learning_insights FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.prompt_variants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_prompt_variants" ON public.prompt_variants;
CREATE POLICY "service_role_all_prompt_variants"
    ON public.prompt_variants FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.product_embeddings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_product_embeddings" ON public.product_embeddings;
CREATE POLICY "service_role_all_product_embeddings"
    ON public.product_embeddings FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.product_recommendations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_product_recommendations" ON public.product_recommendations;
CREATE POLICY "service_role_all_product_recommendations"
    ON public.product_recommendations FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.customer_product_interactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_customer_product_interactions" ON public.customer_product_interactions;
CREATE POLICY "service_role_all_customer_product_interactions"
    ON public.customer_product_interactions FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.product_co_occurrences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_product_co_occurrences" ON public.product_co_occurrences;
CREATE POLICY "service_role_all_product_co_occurrences"
    ON public.product_co_occurrences FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.voice_search_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_voice_search_sessions" ON public.voice_search_sessions;
CREATE POLICY "service_role_all_voice_search_sessions"
    ON public.voice_search_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- prds / agent_runs aliases in prd.py
ALTER TABLE IF EXISTS public.prds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_prds" ON public.prds;
CREATE POLICY "service_role_all_prds"
    ON public.prds FOR ALL TO service_role USING (true) WITH CHECK (true);
