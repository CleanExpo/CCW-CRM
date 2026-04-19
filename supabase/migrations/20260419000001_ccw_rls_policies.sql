-- =============================================================================
-- Migration: CCW-ERP Fleet-Wide RLS Policy Hardening (UNI-1749)
-- Description: Adds service_role bypass policies to all backend-managed tables
--              that have RLS enabled but no policy (Supabase advisor finding).
--
-- Safety:  Wraps every table in an existence check so the migration is safe to
--          run against any DB state — tables that don't exist are silently skipped.
--          DROP POLICY IF EXISTS + CREATE POLICY inside dynamic SQL is idempotent.
--
-- Why service_role bypass?
--   The FastAPI backend connects via the Supabase service_role key, which already
--   bypasses RLS automatically. However, Supabase advisor flags any table that has
--   RLS enabled with ZERO policies. A single service_role bypass policy per table
--   satisfies the advisor without changing observable access behaviour.
-- =============================================================================

DO $$
DECLARE
    t        TEXT;
    tables   TEXT[] := ARRAY[
        -- ----------------------------------------------------------------
        -- Core ERP (users had RLS on but zero policies in erp_permissions.sql)
        -- ----------------------------------------------------------------
        'users',
        'organizations',
        'order_activity',
        'conversation_history',
        'agent_executions',
        'ai_generated_content',
        'background_jobs',

        -- ----------------------------------------------------------------
        -- Workshop
        -- ----------------------------------------------------------------
        'equipment',
        'service_templates',
        'service_template_items',
        'workshop_bookings',
        'service_reminders',
        'equipment_service_history',
        'workshop_job_parts',

        -- ----------------------------------------------------------------
        -- Inventory / Shipments
        -- ----------------------------------------------------------------
        'product_stock_by_location',
        'stock_transfers',
        'stock_reservations',
        'stock_adjustments',
        'suppliers',
        'purchase_orders',
        'purchase_order_items',
        'inbound_shipments',
        'outbound_shipments',
        'carrier_configurations',
        'product_barcodes',
        'stock_takes',
        'stock_take_items',
        'reorder_rules',
        'product_attributes',
        'product_variants',
        'product_dangerous_goods_profiles',

        -- ----------------------------------------------------------------
        -- POS
        -- ----------------------------------------------------------------
        'locations',
        'sales_staff',
        'pos_terminals',
        'bank_accounts',
        'pos_transactions',
        'bank_feeds',

        -- ----------------------------------------------------------------
        -- CRM / Customer Health
        -- ----------------------------------------------------------------
        'contacts',
        'activities',
        'customer_personas',
        'onboarding_sequences',
        'onboarding_touchpoints',

        -- ----------------------------------------------------------------
        -- Workflow / SLA / Notifications
        -- ----------------------------------------------------------------
        'workflow_templates',
        'workflow_template_actions',
        'workflow_instances',
        'sla_rules',
        'sla_instances',
        'in_app_notifications',

        -- ----------------------------------------------------------------
        -- Cin7 Integration
        -- ----------------------------------------------------------------
        'cin7_connections',
        'cin7_product_mappings',
        'cin7_customer_mappings',
        'cin7_order_mappings',
        'cin7_quote_mappings',
        'cin7_supplier_mappings',
        'cin7_purchase_order_mappings',
        'cin7_webhook_subscriptions',
        'cin7_sync_logs',
        'cin7_order_line_items',
        'cin7_purchase_order_line_items',
        'cin7_goods_receipts',
        'cin7_goods_receipt_lines',
        'cin7_stock_adjustments',
        'cin7_stock_transfers',
        'cin7_stock_takes',
        'cin7_stock_take_lines',
        'cin7_shadow_syncs',
        'cin7_sync_gaps',
        'cin7_fulfilments',
        'cin7_invoices',
        'cin7_payments',
        'cin7_chart_of_accounts',
        'cin7_journal_entries',
        'cin7_journal_lines',
        'cin7_account_mappings',
        'cin7_bom_masters',
        'cin7_bom_components',
        'cin7_production_runs',

        -- ----------------------------------------------------------------
        -- Shopify Integration
        -- ----------------------------------------------------------------
        'shopify_connections',
        'shopify_product_mappings',
        'shopify_order_mappings',
        'shopify_webhook_logs',
        'shopify_product_sync_logs',
        'shopify_metafields',
        'shopify_inventory_syncs',
        'shopify_theme_endpoints',
        'shopify_product_translations',
        'shopify_inventory_sync_queue',

        -- ----------------------------------------------------------------
        -- Xero / AP2 / Invoicing
        -- ----------------------------------------------------------------
        'xero_connections',
        'payments',
        'ap2_connections',
        'ap2_mandates',
        'ap2_transactions',
        'ap2_voice_sessions',
        'ap2_agent_interactions',
        'ap2_webhook_logs',
        'tax_rates',
        'invoices',
        'invoice_items',
        'invoice_payments',
        'subscriptions',

        -- ----------------------------------------------------------------
        -- Approvals / Webhooks / Service / Misc
        -- ----------------------------------------------------------------
        'approvals',
        'approval_steps',
        'webhook_events',
        'webhook_metrics',
        'service_requests',
        'containers',
        'container_items',
        'backorders',
        'contact_submissions',
        'demo_requests',
        'submission_notes',

        -- ----------------------------------------------------------------
        -- Email / i18n / AI / Search
        -- ----------------------------------------------------------------
        'email_conversations',
        'email_messages',
        'email_templates',
        'email_webhook_logs',
        'email_logs',
        'email_consents',
        'languages',
        'product_translations',
        'category_translations',
        'ui_translations',
        'email_template_translations',
        'translation_queue',
        'learning_patterns',
        'learning_insights',
        'prompt_variants',
        'product_embeddings',
        'product_recommendations',
        'customer_product_interactions',
        'product_co_occurrences',
        'voice_search_sessions',
        'prds'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        -- Only act on tables that actually exist in this DB instance.
        -- This makes the migration safe to run against the Supabase Cloud DB,
        -- local Docker DB, and any intermediate state.
        IF EXISTS (
            SELECT 1 FROM pg_tables
            WHERE schemaname = 'public' AND tablename = t
        ) THEN
            -- Enable RLS (idempotent — no-op if already enabled)
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

            -- Drop old policy if it exists, then recreate (idempotent)
            EXECUTE format(
                'DROP POLICY IF EXISTS "service_role_all_%s" ON public.%I',
                t, t
            );
            EXECUTE format(
                'CREATE POLICY "service_role_all_%s" ON public.%I '
                'FOR ALL TO service_role USING (true) WITH CHECK (true)',
                t, t
            );
        END IF;
    END LOOP;
END $$;
