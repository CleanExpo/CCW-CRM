-- Enhanced Shopify Integration Database Schema
-- Created: 2026-01-22
-- Purpose: Support for custom metafields, inventory sync, theme APIs, and multi-language product sync

-- 1. Shopify Metafields Table
-- Stores CCW-specific product metadata synced to Shopify metafields

CREATE TABLE shopify_metafields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Product reference
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

    -- Shopify references
    shopify_product_id VARCHAR(255),
    shopify_metafield_id VARCHAR(255) UNIQUE,

    -- Metafield details
    namespace VARCHAR(100) NOT NULL DEFAULT 'ccw_custom',
    key VARCHAR(100) NOT NULL,
    value TEXT,
    value_type VARCHAR(50) NOT NULL DEFAULT 'string',

    -- Sync status
    is_synced BOOLEAN NOT NULL DEFAULT FALSE,
    last_synced_at TIMESTAMPTZ,
    sync_error TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shopify_metafields_product ON shopify_metafields(product_id);
CREATE INDEX idx_shopify_metafields_shopify_product ON shopify_metafields(shopify_product_id);
CREATE INDEX idx_shopify_metafields_shopify_metafield ON shopify_metafields(shopify_metafield_id);
CREATE UNIQUE INDEX idx_shopify_metafields_unique ON shopify_metafields(product_id, namespace, key);

-- 2. Shopify Inventory Sync Table
-- Audit log for all inventory synchronization events

CREATE TABLE shopify_inventory_syncs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Product reference
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

    -- Shopify reference
    shopify_product_id VARCHAR(255),
    shopify_variant_id VARCHAR(255),
    shopify_inventory_item_id VARCHAR(255),

    -- Sync details
    direction VARCHAR(20) NOT NULL, -- 'erp_to_shopify' or 'shopify_to_erp'
    sync_type VARCHAR(50) NOT NULL, -- 'stock_level', 'location_move'

    -- Inventory changes
    old_quantity INTEGER,
    new_quantity INTEGER,
    quantity_delta INTEGER,
    old_location VARCHAR(100),
    new_location VARCHAR(100),

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, completed, failed
    error_message TEXT,

    -- Metadata
    triggered_by VARCHAR(100), -- 'webhook', 'manual', 'scheduled'
    metadata JSONB,

    -- Timestamps
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shopify_inventory_syncs_product ON shopify_inventory_syncs(product_id);
CREATE INDEX idx_shopify_inventory_syncs_shopify_product ON shopify_inventory_syncs(shopify_product_id);
CREATE INDEX idx_shopify_inventory_syncs_direction ON shopify_inventory_syncs(direction);
CREATE INDEX idx_shopify_inventory_syncs_synced_at ON shopify_inventory_syncs(synced_at DESC);

-- 3. Shopify Theme Endpoints Table
-- Tracking for custom API endpoints used by Shopify themes

CREATE TABLE shopify_theme_endpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Endpoint details
    endpoint_path VARCHAR(255) NOT NULL UNIQUE,
    endpoint_type VARCHAR(100) NOT NULL, -- 'product_availability', 'validate_order', 'custom_pricing'
    description TEXT,

    -- Shopify theme details
    shopify_theme_id VARCHAR(255),
    shopify_store_domain VARCHAR(255),

    -- Usage tracking
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    request_count INTEGER NOT NULL DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,

    -- Rate limiting
    rate_limit_per_hour INTEGER DEFAULT 1000,

    -- Caching
    cache_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    cache_ttl_seconds INTEGER DEFAULT 60,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shopify_theme_endpoints_path ON shopify_theme_endpoints(endpoint_path);
CREATE INDEX idx_shopify_theme_endpoints_type ON shopify_theme_endpoints(endpoint_type);
CREATE INDEX idx_shopify_theme_endpoints_active ON shopify_theme_endpoints(is_active);

-- 4. Shopify Product Translations Table
-- Tracks which product translations have been synced to Shopify

CREATE TABLE shopify_product_translations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Product reference
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

    -- Translation reference
    language_code VARCHAR(10) NOT NULL,

    -- Shopify references
    shopify_product_id VARCHAR(255),
    shopify_translation_id VARCHAR(255) UNIQUE,

    -- Sync status
    is_synced BOOLEAN NOT NULL DEFAULT FALSE,
    last_synced_at TIMESTAMPTZ,
    sync_error TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shopify_product_translations_product ON shopify_product_translations(product_id);
CREATE INDEX idx_shopify_product_translations_language ON shopify_product_translations(language_code);
CREATE INDEX idx_shopify_product_translations_shopify_product ON shopify_product_translations(shopify_product_id);
CREATE UNIQUE INDEX idx_shopify_product_translations_unique ON shopify_product_translations(product_id, language_code);

-- Add triggers for updated_at timestamps

CREATE TRIGGER update_shopify_metafields_updated_at
    BEFORE UPDATE ON shopify_metafields
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shopify_theme_endpoints_updated_at
    BEFORE UPDATE ON shopify_theme_endpoints
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shopify_product_translations_updated_at
    BEFORE UPDATE ON shopify_product_translations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation

COMMENT ON TABLE shopify_metafields IS 'CCW-specific product metadata synced to Shopify metafields (namespace: ccw_custom)';
COMMENT ON TABLE shopify_inventory_syncs IS 'Audit log for bidirectional inventory synchronization between ERP and Shopify';
COMMENT ON TABLE shopify_theme_endpoints IS 'Custom API endpoints for Shopify themes to access dynamic ERP data';
COMMENT ON TABLE shopify_product_translations IS 'Tracking for multi-language product content synced to Shopify';

-- Migration complete
-- Version: 1.0
-- Author: CCW Team + Claude Code
-- Date: 2026-01-22
