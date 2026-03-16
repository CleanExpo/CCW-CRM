-- Grant permissions on ERP tables to Supabase roles
-- service_role bypasses RLS but still needs schema/table grants

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Grant permissions on all ERP tables
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Grant sequence permissions
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role, authenticated;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO service_role, authenticated;

-- Enable RLS on ERP tables (required by Supabase)
ALTER TABLE IF EXISTS organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS quote_items ENABLE ROW LEVEL SECURITY;

-- RLS policies: service_role has full access (bypasses RLS automatically)
-- authenticated users can read all data
CREATE POLICY "authenticated_read_organizations" ON organizations FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_products" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_customers" ON customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_orders" ON orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_order_items" ON order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_quotes" ON quotes FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_quote_items" ON quote_items FOR SELECT TO authenticated USING (true);

-- authenticated users can write data
CREATE POLICY "authenticated_write_products" ON products FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_write_customers" ON customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_write_orders" ON orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_write_order_items" ON order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_write_quotes" ON quotes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_write_quote_items" ON quote_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
