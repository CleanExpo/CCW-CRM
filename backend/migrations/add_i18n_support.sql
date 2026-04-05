-- ============================================================================
-- MIGRATION: Multi-Language Support (i18n)
-- Description: Add comprehensive internationalization support for products,
--              categories, UI strings, and email templates
-- Author: CCW Online ERP
-- Date: 2026-01-20
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. LANGUAGES TABLE
-- ============================================================================
-- Stores supported languages with configuration
CREATE TABLE IF NOT EXISTS languages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(10) NOT NULL UNIQUE,  -- ISO 639-1 + region (e.g., 'en-US', 'zh-CN')
    name VARCHAR(100) NOT NULL,        -- English name
    native_name VARCHAR(100) NOT NULL, -- Native name (e.g., '中文')
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_rtl BOOLEAN NOT NULL DEFAULT false, -- Right-to-left (Arabic)
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert initial 10 languages
INSERT INTO languages (code, name, native_name, is_rtl, sort_order) VALUES
    ('en', 'English', 'English', false, 0),
    ('zh-CN', 'Chinese (Simplified)', '简体中文', false, 1),
    ('zh-TW', 'Chinese (Traditional)', '繁體中文', false, 2),
    ('es', 'Spanish', 'Español', false, 3),
    ('pt', 'Portuguese', 'Português', false, 4),
    ('ar', 'Arabic', 'العربية', true, 5),
    ('vi', 'Vietnamese', 'Tiếng Việt', false, 6),
    ('hi', 'Hindi', 'हिन्दी', false, 7),
    ('ta', 'Tamil', 'தமிழ்', false, 8),
    ('te', 'Telugu', 'తెలుగు', false, 9)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 2. PRODUCT TRANSLATIONS TABLE
-- ============================================================================
-- Stores translated product content for each language
CREATE TABLE IF NOT EXISTS product_translations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    language_code VARCHAR(10) NOT NULL REFERENCES languages(code) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    short_description VARCHAR(500),
    specifications JSONB,

    -- Translation metadata
    translation_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    -- Status: pending, ai_generated, human_reviewed, approved
    translated_by VARCHAR(100),  -- 'ai', 'user:john@example.com'
    translated_at TIMESTAMPTZ,
    reviewed_by VARCHAR(100),
    reviewed_at TIMESTAMPTZ,

    -- SEO fields
    meta_title VARCHAR(255),
    meta_description VARCHAR(500),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(product_id, language_code)
);

-- Indexes for product translations
CREATE INDEX IF NOT EXISTS idx_product_translations_product ON product_translations(product_id);
CREATE INDEX IF NOT EXISTS idx_product_translations_lang ON product_translations(language_code);
CREATE INDEX IF NOT EXISTS idx_product_translations_status ON product_translations(translation_status);

-- ============================================================================
-- 3. CATEGORY TRANSLATIONS TABLE
-- ============================================================================
-- Stores translated category names and descriptions
CREATE TABLE IF NOT EXISTS category_translations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_code VARCHAR(100) NOT NULL,  -- Maps to ProductCategory enum
    language_code VARCHAR(10) NOT NULL REFERENCES languages(code) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(category_code, language_code)
);

CREATE INDEX IF NOT EXISTS idx_category_translations_lookup ON category_translations(category_code, language_code);

-- Insert default English category translations
INSERT INTO category_translations (category_code, language_code, name, description) VALUES
    ('heavy_machinery', 'en', 'Heavy Machinery', 'Large construction and industrial equipment'),
    ('hand_tools', 'en', 'Hand Tools', 'Manual tools for various tasks'),
    ('power_tools', 'en', 'Power Tools', 'Electric and pneumatic power tools'),
    ('safety_equipment', 'en', 'Safety Equipment', 'Personal protective equipment and safety gear'),
    ('building_materials', 'en', 'Building Materials', 'Construction materials and supplies'),
    ('electrical', 'en', 'Electrical', 'Electrical components and equipment'),
    ('plumbing', 'en', 'Plumbing', 'Plumbing fixtures and supplies'),
    ('accessories', 'en', 'Accessories', 'Tool accessories and consumables')
ON CONFLICT (category_code, language_code) DO NOTHING;

-- ============================================================================
-- 4. UI TRANSLATIONS TABLE
-- ============================================================================
-- Key-value store for frontend UI strings
CREATE TABLE IF NOT EXISTS ui_translations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    namespace VARCHAR(100) NOT NULL,  -- 'common', 'products', 'orders', etc.
    key VARCHAR(255) NOT NULL,        -- 'button.save', 'error.required'
    language_code VARCHAR(10) NOT NULL REFERENCES languages(code) ON DELETE CASCADE,
    value TEXT NOT NULL,
    context TEXT,  -- Description for translators
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(namespace, key, language_code)
);

CREATE INDEX IF NOT EXISTS idx_ui_translations_lookup ON ui_translations(namespace, language_code);

-- Insert common English UI translations
INSERT INTO ui_translations (namespace, key, language_code, value, context) VALUES
    -- Common
    ('common', 'save', 'en', 'Save', 'Save button label'),
    ('common', 'cancel', 'en', 'Cancel', 'Cancel button label'),
    ('common', 'delete', 'en', 'Delete', 'Delete button label'),
    ('common', 'edit', 'en', 'Edit', 'Edit button label'),
    ('common', 'search', 'en', 'Search', 'Search input placeholder'),
    ('common', 'loading', 'en', 'Loading...', 'Loading state message'),
    ('common', 'error', 'en', 'Error', 'Generic error message'),
    ('common', 'success', 'en', 'Success', 'Generic success message'),

    -- Products
    ('products', 'title', 'en', 'Products', 'Products page title'),
    ('products', 'add', 'en', 'Add Product', 'Add product button'),
    ('products', 'edit', 'en', 'Edit Product', 'Edit product title'),
    ('products', 'name', 'en', 'Product Name', 'Product name field label'),
    ('products', 'sku', 'en', 'SKU', 'SKU field label'),
    ('products', 'price', 'en', 'Price', 'Price field label'),
    ('products', 'stock', 'en', 'Stock', 'Stock field label'),
    ('products', 'category', 'en', 'Category', 'Category field label'),

    -- Orders
    ('orders', 'title', 'en', 'Orders', 'Orders page title'),
    ('orders', 'orderNumber', 'en', 'Order Number', 'Order number field'),
    ('orders', 'status', 'en', 'Status', 'Order status field'),
    ('orders', 'total', 'en', 'Total', 'Order total field')
ON CONFLICT (namespace, key, language_code) DO NOTHING;

-- ============================================================================
-- 5. EMAIL TEMPLATE TRANSLATIONS TABLE
-- ============================================================================
-- Stores translated email templates
CREATE TABLE IF NOT EXISTS email_template_translations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name VARCHAR(100) NOT NULL,  -- 'order_confirmation', 'invoice'
    language_code VARCHAR(10) NOT NULL REFERENCES languages(code) ON DELETE CASCADE,
    subject VARCHAR(255) NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(template_name, language_code)
);

CREATE INDEX IF NOT EXISTS idx_email_templates_lookup ON email_template_translations(template_name, language_code);

-- Insert default English email templates
INSERT INTO email_template_translations (template_name, language_code, subject, body_html, body_text) VALUES
    ('order_confirmation', 'en',
     'Order Confirmation - {{order_number}}',
     '<h1>Thank you for your order!</h1><p>Order Number: {{order_number}}</p><p>Total: {{total}}</p>',
     'Thank you for your order! Order Number: {{order_number}} Total: {{total}}'),

    ('invoice', 'en',
     'Invoice - {{invoice_number}}',
     '<h1>Invoice</h1><p>Invoice Number: {{invoice_number}}</p><p>Amount Due: {{amount}}</p>',
     'Invoice Number: {{invoice_number}} Amount Due: {{amount}}')
ON CONFLICT (template_name, language_code) DO NOTHING;

-- ============================================================================
-- 6. TRANSLATION QUEUE TABLE
-- ============================================================================
-- Manages AI translation workflow and batch processing
CREATE TABLE IF NOT EXISTS translation_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,  -- 'product', 'category', 'email_template', 'ui'
    entity_id UUID NOT NULL,
    target_language VARCHAR(10) NOT NULL REFERENCES languages(code),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    -- Status: pending, processing, completed, failed, requires_review
    priority INT NOT NULL DEFAULT 5,  -- 1-10 (1 = highest)
    error_message TEXT,
    attempts INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_translation_queue_status ON translation_queue(status, priority DESC);
CREATE INDEX IF NOT EXISTS idx_translation_queue_entity ON translation_queue(entity_type, entity_id);

-- ============================================================================
-- 7. UPDATE TRIGGERS FOR updated_at
-- ============================================================================
-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all translation tables
CREATE TRIGGER update_languages_updated_at
    BEFORE UPDATE ON languages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_translations_updated_at
    BEFORE UPDATE ON product_translations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_category_translations_updated_at
    BEFORE UPDATE ON category_translations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ui_translations_updated_at
    BEFORE UPDATE ON ui_translations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_template_translations_updated_at
    BEFORE UPDATE ON email_template_translations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_translation_queue_updated_at
    BEFORE UPDATE ON translation_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 8. HELPER VIEWS
-- ============================================================================
-- View to get translation coverage statistics
CREATE OR REPLACE VIEW v_translation_coverage AS
SELECT
    l.code AS language_code,
    l.name AS language_name,
    COUNT(DISTINCT pt.product_id) AS products_translated,
    (SELECT COUNT(*) FROM products WHERE is_active = true) AS total_products,
    ROUND(
        (COUNT(DISTINCT pt.product_id)::DECIMAL /
         NULLIF((SELECT COUNT(*) FROM products WHERE is_active = true), 0)) * 100,
        2
    ) AS coverage_percentage,
    l.sort_order
FROM languages l
LEFT JOIN product_translations pt ON l.code = pt.language_code
WHERE l.is_active = true
GROUP BY l.code, l.name, l.sort_order
ORDER BY l.sort_order;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Summary:
-- ✅ 6 tables created: languages, product_translations, category_translations,
--    ui_translations, email_template_translations, translation_queue
-- ✅ Initial data seeded: 10 languages, English category translations,
--    common UI strings, email templates
-- ✅ Indexes created for optimal query performance
-- ✅ Triggers for automatic timestamp updates
-- ✅ Helper view for translation coverage tracking
-- ============================================================================
