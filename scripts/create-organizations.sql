-- Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_name ON organizations(name);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

-- Insert default organization
INSERT INTO organizations (id, name, slug, is_active, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000099',
    'CCW Equipment Demo',
    'ccw-demo',
    true,
    NOW(),
    NOW()
)
ON CONFLICT (slug) DO NOTHING;

-- Add organization_id to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Set default organization for existing products
UPDATE products SET organization_id = '00000000-0000-0000-0000-000000000099' WHERE organization_id IS NULL;

-- Add organization_id to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
UPDATE customers SET organization_id = '00000000-0000-0000-0000-000000000099' WHERE organization_id IS NULL;

-- Add organization_id to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
UPDATE orders SET organization_id = '00000000-0000-0000-0000-000000000099' WHERE organization_id IS NULL;

-- Add organization_id to quotes table
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
UPDATE quotes SET organization_id = '00000000-0000-0000-0000-000000000099' WHERE organization_id IS NULL;

SELECT 'Organizations setup complete!' as status;
