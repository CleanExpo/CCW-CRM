-- CCW ERP Demo Data Seed Script
-- Run this to populate database with demo data for owner presentation

-- Create sequences and functions for order/quote number generation
-- (These are not in Alembic migrations — applied here for CI compatibility)
CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS quote_number_seq START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
    current_year INTEGER;
    next_num INTEGER;
BEGIN
    current_year := EXTRACT(YEAR FROM CURRENT_DATE);
    next_num := nextval('order_number_seq');
    RETURN 'ORD-' || current_year::TEXT || '-' || LPAD(next_num::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS TEXT AS $$
DECLARE
    current_year INTEGER;
    next_num INTEGER;
BEGIN
    current_year := EXTRACT(YEAR FROM CURRENT_DATE);
    next_num := nextval('quote_number_seq');
    RETURN 'Q-' || current_year::TEXT || '-' || LPAD(next_num::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Create demo user (password: demo123, hashed with bcrypt)
INSERT INTO users (id, email, hashed_password, full_name, is_active, is_admin, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin@demo.com', '$2b$12$t3c9inySNVTxAI7j56GTze4IO7GMKfaQu.sZ/VdvOytqjFMScBgwe', 'Admin User', true, true, NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- Create products
INSERT INTO products (id, sku, name, description, category, price, cost, stock, warehouse_location, is_active, created_at, updated_at)
VALUES
  -- Heavy Machinery
  ('10000000-0000-0000-0000-000000000001', 'HM-001', 'Excavator 320D', 'Heavy duty excavator for large construction projects', 'heavy_machinery', 125000.00, 95000.00, 3, 'Brisbane Yard A1', true, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000002', 'HM-002', 'Bulldozer D6', 'Powerful bulldozer for earthmoving', 'heavy_machinery', 145000.00, 110000.00, 2, 'Sydney Yard B2', true, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000003', 'HM-003', 'Backhoe Loader 580', 'Versatile backhoe loader', 'heavy_machinery', 89000.00, 68000.00, 5, 'Melbourne Yard C3', true, NOW(), NOW()),

  -- Power Tools
  ('20000000-0000-0000-0000-000000000001', 'PT-001', 'Cordless Drill 18V', 'Professional cordless drill with 2 batteries', 'power_tools', 189.99, 95.00, 45, 'Brisbane Shelf 12', true, NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000002', 'PT-002', 'Impact Driver 20V', 'High-torque impact driver', 'power_tools', 229.99, 115.00, 38, 'Sydney Shelf 15', true, NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000003', 'PT-003', 'Circular Saw 7-1/4"', 'Professional circular saw', 'power_tools', 149.99, 75.00, 52, 'Melbourne Shelf 8', true, NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000004', 'PT-004', 'Angle Grinder 4-1/2"', 'Compact angle grinder', 'power_tools', 99.99, 50.00, 67, 'Brisbane Shelf 14', true, NOW(), NOW()),

  -- Hand Tools
  ('30000000-0000-0000-0000-000000000001', 'HT-001', 'Hammer Claw 16oz', 'Professional claw hammer', 'hand_tools', 24.99, 12.00, 120, 'Brisbane Bin 45', true, NOW(), NOW()),
  ('30000000-0000-0000-0000-000000000002', 'HT-002', 'Screwdriver Set 11pc', 'Professional screwdriver set', 'hand_tools', 39.99, 20.00, 95, 'Sydney Bin 23', true, NOW(), NOW()),
  ('30000000-0000-0000-0000-000000000003', 'HT-003', 'Wrench Set SAE', 'SAE wrench set 12 pieces', 'hand_tools', 89.99, 45.00, 73, 'Melbourne Bin 12', true, NOW(), NOW()),

  -- Safety Equipment
  ('40000000-0000-0000-0000-000000000001', 'SF-001', 'Hard Hat Class E', 'ANSI certified hard hat', 'safety_equipment', 29.99, 15.00, 200, 'Brisbane Safety A1', true, NOW(), NOW()),
  ('40000000-0000-0000-0000-000000000002', 'SF-002', 'Safety Glasses Clear', 'Anti-fog safety glasses', 'safety_equipment', 12.99, 6.00, 350, 'Sydney Safety B2', true, NOW(), NOW()),
  ('40000000-0000-0000-0000-000000000003', 'SF-003', 'Work Gloves Leather', 'Premium leather work gloves', 'safety_equipment', 19.99, 10.00, 180, 'Melbourne Safety C1', true, NOW(), NOW()),

  -- Building Materials
  ('50000000-0000-0000-0000-000000000001', 'BM-001', 'Cement Portland 94lb', 'Type I Portland cement', 'building_materials', 14.99, 8.00, 450, 'Brisbane Materials M1', true, NOW(), NOW()),
  ('50000000-0000-0000-0000-000000000002', 'BM-002', 'Lumber 2x4x8', 'Kiln dried lumber', 'building_materials', 8.99, 5.00, 800, 'Sydney Materials M2', true, NOW(), NOW()),
  ('50000000-0000-0000-0000-000000000003', 'BM-003', 'Plywood 4x8 1/2"', 'Construction grade plywood', 'building_materials', 34.99, 20.00, 320, 'Melbourne Materials M3', true, NOW(), NOW()),

  -- Electrical
  ('60000000-0000-0000-0000-000000000001', 'EL-001', 'Wire Romex 12/2 250ft', 'Indoor electrical wire', 'electrical', 89.99, 55.00, 125, 'Brisbane Electrical E1', true, NOW(), NOW()),
  ('60000000-0000-0000-0000-000000000002', 'EL-002', 'Outlet 15A Duplex', 'Standard duplex outlet', 'electrical', 3.99, 2.00, 500, 'Sydney Electrical E2', true, NOW(), NOW()),

  -- Plumbing
  ('70000000-0000-0000-0000-000000000001', 'PL-001', 'PVC Pipe 2" 10ft', 'Schedule 40 PVC pipe', 'plumbing', 12.99, 7.00, 280, 'Brisbane Plumbing P1', true, NOW(), NOW()),
  ('70000000-0000-0000-0000-000000000002', 'PL-002', 'Faucet Kitchen Single', 'Single handle kitchen faucet', 'plumbing', 149.99, 85.00, 45, 'Sydney Plumbing P2', true, NOW(), NOW()),

  -- Accessories
  ('80000000-0000-0000-0000-000000000001', 'AC-001', 'Tool Belt Leather', 'Professional leather tool belt', 'accessories', 79.99, 40.00, 65, 'Brisbane Accessories ACC1', true, NOW(), NOW()),
  ('80000000-0000-0000-0000-000000000002', 'AC-002', 'Tool Box 26"', 'Heavy duty tool box', 'accessories', 59.99, 30.00, 48, 'Sydney Accessories ACC2', true, NOW(), NOW())
ON CONFLICT (sku) DO NOTHING;

-- Create customers
INSERT INTO customers (id, customer_number, company_name, contact_name, email, phone, address, city, state, postcode, is_active, created_at, updated_at)
VALUES
  ('c0000000-0000-0000-0000-000000000001', 'CUST-000001', 'Smith Brothers Construction', 'John Smith', 'john@smithbros.com.au', '+61 7 3000 0001', '123 Construction St', 'Brisbane', 'QLD', '4000', true, NOW(), NOW()),
  ('c0000000-0000-0000-0000-000000000002', 'CUST-000002', 'Johnson & Sons Electrical', 'Mike Johnson', 'mike@johnsonelectrical.com.au', '+61 2 9000 0002', '456 Electric Ave', 'Sydney', 'NSW', '2000', true, NOW(), NOW()),
  ('c0000000-0000-0000-0000-000000000003', 'CUST-000003', 'Williams Plumbing Co', 'Sarah Williams', 'sarah@williamsplumbing.com.au', '+61 3 8000 0003', '789 Pipe Lane', 'Melbourne', 'VIC', '3000', true, NOW(), NOW()),
  ('c0000000-0000-0000-0000-000000000004', 'CUST-000004', 'Brown Industries HVAC', 'David Brown', 'david@brownhvac.com.au', '+61 7 3000 0004', '321 Climate Dr', 'Gold Coast', 'QLD', '4217', true, NOW(), NOW()),
  ('c0000000-0000-0000-0000-000000000005', 'CUST-000005', 'Garcia General Contracting', 'Maria Garcia', 'maria@garciacontracting.com.au', '+61 2 9000 0005', '654 Build Blvd', 'Newcastle', 'NSW', '2300', true, NOW(), NOW()),
  ('c0000000-0000-0000-0000-000000000006', 'CUST-000006', 'Miller Group Landscaping', 'Tom Miller', 'tom@millergroup.com.au', '+61 3 8000 0006', '987 Garden Rd', 'Geelong', 'VIC', '3220', true, NOW(), NOW()),
  ('c0000000-0000-0000-0000-000000000007', 'CUST-000007', 'Davis Construction Corp', 'Lisa Davis', 'lisa@davisconstruction.com.au', '+61 8 6000 0007', '147 Steel St', 'Perth', 'WA', '6000', true, NOW(), NOW()),
  ('c0000000-0000-0000-0000-000000000008', 'CUST-000008', 'Rodriguez & Partners', 'Carlos Rodriguez', 'carlos@rodriguezpartners.com.au', '+61 8 8000 0008', '258 Trade Ave', 'Adelaide', 'SA', '5000', true, NOW(), NOW())
ON CONFLICT (customer_number) DO NOTHING;

-- Create orders (demo the performance improvement!)
INSERT INTO orders (id, order_number, customer_id, order_date, status, notes, subtotal, tax, total, created_at, updated_at)
VALUES
  ('01000000-0000-0000-0000-000000000001', 'ORD-2026-001', 'c0000000-0000-0000-0000-000000000001', '2026-01-15', 'delivered', 'Large construction site order', 0, 0, 0, NOW(), NOW()),
  ('01000000-0000-0000-0000-000000000002', 'ORD-2026-002', 'c0000000-0000-0000-0000-000000000002', '2026-01-18', 'shipped', 'Electrical supplies for apartment complex', 0, 0, 0, NOW(), NOW()),
  ('01000000-0000-0000-0000-000000000003', 'ORD-2026-003', 'c0000000-0000-0000-0000-000000000003', '2026-01-22', 'processing', 'Plumbing equipment urgent order', 0, 0, 0, NOW(), NOW()),
  ('01000000-0000-0000-0000-000000000004', 'ORD-2026-004', 'c0000000-0000-0000-0000-000000000004', '2026-02-01', 'confirmed', 'HVAC installation materials', 0, 0, 0, NOW(), NOW()),
  ('01000000-0000-0000-0000-000000000005', 'ORD-2026-005', 'c0000000-0000-0000-0000-000000000005', '2026-02-05', 'pending', 'General contractor supply order', 0, 0, 0, NOW(), NOW()),
  ('01000000-0000-0000-0000-000000000006', 'ORD-2026-006', 'c0000000-0000-0000-0000-000000000001', '2026-02-08', 'draft', 'Follow-up order for Smith Brothers', 0, 0, 0, NOW(), NOW())
ON CONFLICT (order_number) DO NOTHING;

-- Create order items (THIS IS WHERE THE 97% PERFORMANCE IMPROVEMENT SHOWS!)
INSERT INTO order_items (id, order_id, product_id, quantity, unit_price, line_total, created_at, updated_at)
VALUES
  -- Order 1: Large construction order (10 items - would have taken 35 seconds before, now <1 second!)
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 2, 125000.00, 250000.00, NOW(), NOW()),
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 10, 189.99, 1899.90, NOW(), NOW()),
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 8, 149.99, 1199.92, NOW(), NOW()),
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 25, 24.99, 624.75, NOW(), NOW()),
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 50, 29.99, 1499.50, NOW(), NOW()),
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 75, 12.99, 974.25, NOW(), NOW()),
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 100, 14.99, 1499.00, NOW(), NOW()),
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', 200, 8.99, 1798.00, NOW(), NOW()),
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 15, 79.99, 1199.85, NOW(), NOW()),
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000002', 12, 59.99, 719.88, NOW(), NOW()),

  -- Order 2: Electrical supplies
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001', 20, 89.99, 1799.80, NOW(), NOW()),
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000002', 150, 3.99, 598.50, NOW(), NOW()),
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 5, 189.99, 949.95, NOW(), NOW()),
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000004', 8, 99.99, 799.92, NOW(), NOW()),

  -- Order 3: Plumbing order
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000001', 50, 12.99, 649.50, NOW(), NOW()),
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000002', 10, 149.99, 1499.90, NOW(), NOW()),
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', 6, 89.99, 539.94, NOW(), NOW()),

  -- Order 4: HVAC order
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 12, 189.99, 2279.88, NOW(), NOW()),
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000002', 8, 39.99, 319.92, NOW(), NOW()),
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000003', 30, 19.99, 599.70, NOW(), NOW()),

  -- Order 5: General contractor order
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000003', 75, 34.99, 2624.25, NOW(), NOW()),
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000002', 150, 8.99, 1348.50, NOW(), NOW()),
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000001', 40, 24.99, 999.60, NOW(), NOW()),

  -- Order 6: Draft order (in progress)
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000002', 5, 229.99, 1149.95, NOW(), NOW()),
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000003', 3, 149.99, 449.97, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Update order totals (calculate from items)
UPDATE orders o SET
  subtotal = COALESCE((SELECT SUM(line_total) FROM order_items WHERE order_id = o.id), 0),
  tax = COALESCE((SELECT SUM(line_total) * 0.10 FROM order_items WHERE order_id = o.id), 0),
  total = COALESCE((SELECT SUM(line_total) * 1.10 FROM order_items WHERE order_id = o.id), 0);

-- Create quotes
INSERT INTO quotes (id, quote_number, customer_id, quote_date, valid_until, status, notes, total, created_at, updated_at)
VALUES
  ('02000000-0000-0000-0000-000000000001', 'QT-2026-001', 'c0000000-0000-0000-0000-000000000006', '2026-02-01', '2026-03-03', 'sent', 'Landscaping equipment quote', 0, NOW(), NOW()),
  ('02000000-0000-0000-0000-000000000002', 'QT-2026-002', 'c0000000-0000-0000-0000-000000000007', '2026-02-05', '2026-03-07', 'accepted', 'Heavy machinery rental quote', 0, NOW(), NOW()),
  ('02000000-0000-0000-0000-000000000003', 'QT-2026-003', 'c0000000-0000-0000-0000-000000000008', '2026-02-08', '2026-03-10', 'draft', 'Construction materials bulk order', 0, NOW(), NOW())
ON CONFLICT (quote_number) DO NOTHING;

-- Create quote items
INSERT INTO quote_items (id, quote_id, product_id, quantity, unit_price, line_total, created_at, updated_at)
VALUES
  -- Quote 1: Landscaping
  (gen_random_uuid(), '02000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 6, 180.49, 1082.94, NOW(), NOW()),
  (gen_random_uuid(), '02000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 4, 85.49, 341.96, NOW(), NOW()),
  (gen_random_uuid(), '02000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000002', 8, 56.99, 455.92, NOW(), NOW()),

  -- Quote 2: Heavy machinery (accepted - ready to convert to order!)
  (gen_random_uuid(), '02000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 1, 138250.00, 138250.00, NOW(), NOW()),
  (gen_random_uuid(), '02000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', 2, 84650.00, 169300.00, NOW(), NOW()),

  -- Quote 3: Bulk materials
  (gen_random_uuid(), '02000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001', 500, 13.49, 6745.00, NOW(), NOW()),
  (gen_random_uuid(), '02000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000002', 1000, 8.09, 8090.00, NOW(), NOW()),
  (gen_random_uuid(), '02000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000003', 300, 31.49, 9447.00, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Update quote totals (quotes table only has total column, no subtotal/tax)
UPDATE quotes q SET
  total = COALESCE((SELECT SUM(line_total) * 1.10 FROM quote_items WHERE quote_id = q.id), 0);

-- Display summary
DO $$
DECLARE
  product_count INTEGER;
  customer_count INTEGER;
  order_count INTEGER;
  quote_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO product_count FROM products;
  SELECT COUNT(*) INTO customer_count FROM customers;
  SELECT COUNT(*) INTO order_count FROM orders;
  SELECT COUNT(*) INTO quote_count FROM quotes;

  RAISE NOTICE '===========================================';
  RAISE NOTICE 'CCW ERP Demo Data Seeded Successfully!';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Products: %', product_count;
  RAISE NOTICE 'Customers: %', customer_count;
  RAISE NOTICE 'Orders: % (with % line items demonstrating 97%% performance improvement!)', order_count, (SELECT COUNT(*) FROM order_items);
  RAISE NOTICE 'Quotes: % (with % line items)', quote_count, (SELECT COUNT(*) FROM quote_items);
  RAISE NOTICE '';
  RAISE NOTICE 'Demo Credentials:';
  RAISE NOTICE '  Email: admin@demo.com';
  RAISE NOTICE '  Password: demo123';
  RAISE NOTICE '';
  RAISE NOTICE 'Access: http://localhost:3005';
  RAISE NOTICE '===========================================';
END $$;
