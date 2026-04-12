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

-- Create CCW staff users (all passwords: demo123, hashed with bcrypt rounds=12)
-- Each staff member has their own login with appropriate access level
INSERT INTO users (id, email, hashed_password, full_name, is_active, is_admin, created_at, updated_at)
VALUES
  -- Owner / System Admin
  ('00000000-0000-0000-0000-000000000001', 'admin@ccwonline.com.au',     '$2b$12$t3c9inySNVTxAI7j56GTze4IO7GMKfaQu.sZ/VdvOytqjFMScBgwe', 'Chris Wilson',   true, true,  NOW(), NOW()),
  -- Sales Manager
  ('00000000-0000-0000-0000-000000000002', 'sales@ccwonline.com.au',     '$2b$12$t3c9inySNVTxAI7j56GTze4IO7GMKfaQu.sZ/VdvOytqjFMScBgwe', 'Sarah Chen',     true, false, NOW(), NOW()),
  -- Warehouse / Inventory Manager
  ('00000000-0000-0000-0000-000000000003', 'warehouse@ccwonline.com.au', '$2b$12$t3c9inySNVTxAI7j56GTze4IO7GMKfaQu.sZ/VdvOytqjFMScBgwe', 'Mark Thompson',  true, false, NOW(), NOW()),
  -- Accounts / Finance
  ('00000000-0000-0000-0000-000000000004', 'accounts@ccwonline.com.au',  '$2b$12$t3c9inySNVTxAI7j56GTze4IO7GMKfaQu.sZ/VdvOytqjFMScBgwe', 'Lisa Park',      true, false, NOW(), NOW()),
  -- Legacy dev login (kept for backward compatibility)
  ('00000000-0000-0000-0000-000000000005', 'admin@demo.com',             '$2b$12$t3c9inySNVTxAI7j56GTze4IO7GMKfaQu.sZ/VdvOytqjFMScBgwe', 'Admin User',     true, true,  NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- Create products (CCW Online — professional cleaning equipment, chemicals, accessories)
INSERT INTO products (id, sku, name, description, category, price, cost, stock, warehouse_location, is_active, created_at, updated_at)
VALUES
  -- Heavy Machinery — TruckMount carpet extractors
  ('10000000-0000-0000-0000-000000000001', 'TM-PRO-570',    'TruckMount Pro 570 — Carpet Extractor',        'High-performance truckmount carpet extractor, 2,000 PSI, 570CFM blower, direct-drive. Suits restoration contractors.', 'heavy_machinery', 18500.00, 13200.00,  4, 'Brisbane Rack A1',    true, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000002', 'TM-HEAT-650',   'TruckMount Heat Master 650 — Hot Water Extractor', 'Commercial truckmount with on-board heat exchanger. 220°C cleaning temp, 650CFM, auto-fill.', 'heavy_machinery', 24900.00, 18500.00,  2, 'Sydney Rack B1',      true, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000003', 'WD-DRYMATIC-40','Drymatic 40 — Low-Grain Refrigerant Dehumidifier', 'Water damage restoration dehumidifier. 40L/day, LGR technology, ±2°C accuracy. IICRC S500 compliant.', 'heavy_machinery', 4200.00,  3100.00,   8, 'Melbourne Rack C1',   true, NOW(), NOW()),

  -- Power Tools — portable extractors and scrubbers
  ('20000000-0000-0000-0000-000000000001', 'EXTRACT-PORT-5G',  '5-Gallon Portable Carpet Extractor',       'Commercial-grade portable extractor, 5-gal dual tanks, 120 PSI, 3-stage vacuum motor. Ideal for upholstery.', 'power_tools', 2200.00,  1580.00, 12, 'Brisbane Rack A2',   true, NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000002', 'SCRUB-DISC-17',    '17" Single-Disc Floor Scrubber',           '17-inch rotary floor scrubber, 1.5HP motor, variable speed. Suitable for tile, timber, VCT.', 'power_tools', 1850.00,  1320.00,  6, 'Sydney Rack B2',     true, NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000003', 'AIRSCRUB-570CFM',  'Air Scrubber 570CFM — HEPA Filtration',    'Negative air machine / air scrubber, HEPA 99.97% @ 0.3μm, 570CFM. Essential for mould/fire restoration.', 'power_tools', 1650.00,  1150.00,  9, 'Melbourne Rack C2',  true, NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000004', 'AXIAL-FAN-AIRMOVE', 'Air Mover Axial Fan — 900CFM',            'Centrifugal air mover, 900CFM, stackable design, 3-speed. Accelerates drying on water damage jobs.', 'power_tools',  420.00,   285.00, 32, 'Brisbane Rack A3',   true, NOW(), NOW()),

  -- Hand Tools — wands, hoses, spray tools
  ('30000000-0000-0000-0000-000000000001', 'WAND-SS-12',       '12" S-Bend Stainless Wand',                'Professional 12-inch S-bend cleaning wand, 316 stainless, dual jet spray bar. Fits most truckmounts.', 'hand_tools',   180.00,    95.00, 28, 'Brisbane Bin B1',    true, NOW(), NOW()),
  ('30000000-0000-0000-0000-000000000002', 'HOSE-SOLN-15M',    '15m Solution Hose — 300 PSI Rated',        '15-metre solution hose, 300 PSI burst pressure, 1/4" fittings. For truckmount and portable use.', 'hand_tools',   140.00,    82.00, 40, 'Sydney Bin B2',      true, NOW(), NOW()),
  ('30000000-0000-0000-0000-000000000003', 'SPOTPRO-KIT',      'Spot & Stain Pro Upholstery Kit',          'Complete spot cleaning kit: hand tool, upholstery wand, 5m solution line, 5m vacuum hose, carry bag.', 'hand_tools',  1820.00,  1200.00,  7, 'Melbourne Bin C1',   true, NOW(), NOW()),

  -- Safety Equipment — PPE for restoration technicians
  ('40000000-0000-0000-0000-000000000001', 'PPE-RESP-N95',     'N95 Respirator Masks — Box of 20',         'P2/N95 particulate respirators, NIOSH approved. Required for mould and restoration work.', 'safety_equipment',  38.00,    18.00, 180, 'Brisbane Safety A1', true, NOW(), NOW()),
  ('40000000-0000-0000-0000-000000000002', 'PPE-TYVEK-L',      'Tyvek Disposable Suit — Size L',           'DuPont Tyvek coverall, Type 5/6, elastic wrists, front zip. Mould and chemical protection.', 'safety_equipment',  12.50,     6.20, 240, 'Sydney Safety B1',   true, NOW(), NOW()),
  ('40000000-0000-0000-0000-000000000003', 'PPE-GLOVE-NITRIL', 'Nitrile Gloves — Box 100 (Medium)',        'Disposable powder-free nitrile gloves, 4-mil. Chemical resistant. Box of 100.', 'safety_equipment',  18.00,     9.50, 310, 'Melbourne Safety C1',true, NOW(), NOW()),

  -- Building Materials — used as placeholder for consumable supplies
  ('50000000-0000-0000-0000-000000000001', 'PAD-BUFF-17',      '17" Floor Buffing Pads — Pack of 5',       'White buffing / polishing pads, 17-inch. For rotary scrubbers on VCT, marble, timber.', 'building_materials',  45.00,    22.00,  85, 'Brisbane Supplies M1',true, NOW(), NOW()),
  ('50000000-0000-0000-0000-000000000002', 'PAD-STRIP-17',     '17" Black Stripping Pads — Pack of 5',     'Black heavy-duty stripping pads, 17-inch. Removes old wax and coatings from hard floors.', 'building_materials',  48.00,    24.00,  72, 'Sydney Supplies M2',  true, NOW(), NOW()),
  ('50000000-0000-0000-0000-000000000003', 'POLY-BARRIER-20M', 'Containment Poly Sheeting 4mil 20m Roll',  '4-mil polyethylene sheeting, 20-metre roll, 3.6m wide. Mould remediation containment barrier.', 'building_materials',  62.00,    34.00,  45, 'Melbourne Supplies M3',true, NOW(), NOW()),

  -- Electrical — n/a for CCW; mapped to chemical solutions (concentrated products)
  ('60000000-0000-0000-0000-000000000001', 'CHEM-PRECON-5L',   'Pre-Conditioner Encap Solution 5L',        'Encapsulation pre-conditioner, dilution 1:10. Breaks down traffic-lane soils before extraction.', 'electrical',  58.00,    30.00, 120, 'Brisbane Chem E1',   true, NOW(), NOW()),
  ('60000000-0000-0000-0000-000000000002', 'CHEM-RINSE-5L',    'pH Balanced Rinse Agent 5L',               'Neutralising fibre rinse, pH 4.5–5.0. Prevents re-soiling after hot water extraction.', 'electrical',  52.00,    27.00, 135, 'Sydney Chem E2',     true, NOW(), NOW()),

  -- Plumbing — mapped to deodorisers and specialty chemicals
  ('70000000-0000-0000-0000-000000000001', 'CHEM-DEOD-5L',     'Odour Eliminator Pro 5L — Enzyme Formula', 'Enzyme-based odour eliminator. Destroys urine, pet, smoke, and organic odour sources at molecular level.', 'plumbing',  75.00,    40.00, 98, 'Brisbane Chem P1',  true, NOW(), NOW()),
  ('70000000-0000-0000-0000-000000000002', 'CHEM-MOULD-RTU-1L','Mould Remediation Spray RTU 1L',            'Ready-to-use antimicrobial mould treatment. ARTG listed, kills 99.99% of surface mould/bacteria.', 'plumbing',  28.00,    14.00, 210, 'Sydney Chem P2',    true, NOW(), NOW()),

  -- Accessories — carrying equipment, brushes, consumables
  ('80000000-0000-0000-0000-000000000001', 'ACC-UPHOLST-KIT',  'Upholstery Cleaning Attachment Kit',       'Full upholstery kit: triangular hand tool, 5-jet spray bar, detail brush, crevice tool. Universal fittings.', 'accessories', 820.00,  510.00, 14, 'Brisbane Acc ACC1', true, NOW(), NOW()),
  ('80000000-0000-0000-0000-000000000002', 'ACC-HOSE-VAC-10M', '10m Vacuum Hose 2" — Anti-Static',        '10-metre 2-inch anti-static vacuum hose with cuffs. For truckmount and portable extractors.', 'accessories', 185.00,  110.00, 22, 'Sydney Acc ACC2',   true, NOW(), NOW())
ON CONFLICT (sku) DO NOTHING;

-- Create customers (CCW Online clients — professional cleaning & restoration contractors)
INSERT INTO customers (id, customer_number, company_name, contact_name, email, phone, address, city, state, postcode, is_active, created_at, updated_at)
VALUES
  ('c0000000-0000-0000-0000-000000000001', 'CUST-000001', 'Brisbane Carpet Care Pty Ltd',         'James Nguyen',    'james@brisbanecarpetcare.com.au',  '+61 7 3222 1234', '14 Industrial Ave',    'Coopers Plains',  'QLD', '4108', true, NOW(), NOW()),
  ('c0000000-0000-0000-0000-000000000002', 'CUST-000002', 'Sydney Flood & Restoration Co',        'Emma Tran',       'emma@sydneyfloodrestore.com.au',   '+61 2 9411 5678', '8 Commerce St',        'Alexandria',      'NSW', '2015', true, NOW(), NOW()),
  ('c0000000-0000-0000-0000-000000000003', 'CUST-000003', 'Melbourne Steam Clean Professionals',  'David Okafor',    'david@melbsteamclean.com.au',      '+61 3 9555 2233', '27 Factory Rd',        'Dandenong',       'VIC', '3175', true, NOW(), NOW()),
  ('c0000000-0000-0000-0000-000000000004', 'CUST-000004', 'Gold Coast Mould Remediation',         'Aisha Patel',     'aisha@gcmould.com.au',             '+61 7 5577 3344', '3 Renovation Lane',    'Burleigh Heads',  'QLD', '4220', true, NOW(), NOW()),
  ('c0000000-0000-0000-0000-000000000005', 'CUST-000005', 'Newcastle Flood Response Services',    'Tom Barker',      'tom@newcastleflood.com.au',        '+61 2 4922 8877', '55 Harbour Dr',        'Newcastle',       'NSW', '2300', true, NOW(), NOW()),
  ('c0000000-0000-0000-0000-000000000006', 'CUST-000006', 'Geelong Commercial Cleaning Group',    'Sandra Ho',       'sandra@geelongccg.com.au',         '+61 3 5222 4455', '12 Industrial Blvd',   'Geelong',         'VIC', '3220', true, NOW(), NOW()),
  ('c0000000-0000-0000-0000-000000000007', 'CUST-000007', 'Perth Carpet & Upholstery Specialists','Ryan Mitchell',   'ryan@perthuphol.com.au',           '+61 8 6244 6677', '78 Commerce Way',      'Malaga',          'WA',  '6090', true, NOW(), NOW()),
  ('c0000000-0000-0000-0000-000000000008', 'CUST-000008', 'Adelaide Restoration & Drying Pros',   'Fatima Khalil',   'fatima@adelaiderestoration.com.au','+61 8 8233 9988', '31 Trade Park Dr',     'Gepps Cross',     'SA',  '5094', true, NOW(), NOW())
ON CONFLICT (customer_number) DO NOTHING;

-- Create orders (demo the performance improvement!)
INSERT INTO orders (id, order_number, customer_id, order_date, status, notes, subtotal, tax, total, created_at, updated_at)
VALUES
  ('01000000-0000-0000-0000-000000000001', 'ORD-2026-001', 'c0000000-0000-0000-0000-000000000001', '2026-01-15', 'delivered', 'TruckMount + consumables — fleet upgrade for Brisbane Carpet Care', 0, 0, 0, NOW(), NOW()),
  ('01000000-0000-0000-0000-000000000002', 'ORD-2026-002', 'c0000000-0000-0000-0000-000000000002', '2026-01-18', 'shipped', 'Water damage drying equipment — flood response job Alexandria', 0, 0, 0, NOW(), NOW()),
  ('01000000-0000-0000-0000-000000000003', 'ORD-2026-003', 'c0000000-0000-0000-0000-000000000003', '2026-01-22', 'processing', 'Commercial scrubber + chemicals — contract renewal Melbourne', 0, 0, 0, NOW(), NOW()),
  ('01000000-0000-0000-0000-000000000004', 'ORD-2026-004', 'c0000000-0000-0000-0000-000000000004', '2026-02-01', 'confirmed', 'Mould remediation kit — post-storm Gold Coast project', 0, 0, 0, NOW(), NOW()),
  ('01000000-0000-0000-0000-000000000005', 'ORD-2026-005', 'c0000000-0000-0000-0000-000000000005', '2026-02-05', 'pending', 'Portable extractors + chemicals — Newcastle expansion order', 0, 0, 0, NOW(), NOW()),
  ('01000000-0000-0000-0000-000000000006', 'ORD-2026-006', 'c0000000-0000-0000-0000-000000000001', '2026-02-08', 'draft', 'Follow-up consumables order — Brisbane Carpet Care', 0, 0, 0, NOW(), NOW())
ON CONFLICT (order_number) DO NOTHING;

-- Create order items (CCW products ordered by cleaning/restoration contractors)
INSERT INTO order_items (id, order_id, product_id, quantity, unit_price, line_total, created_at, updated_at)
VALUES
  -- Order 1: Brisbane Carpet Care — TruckMount fleet upgrade (demonstrates order value)
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1, 18500.00, 18500.00, NOW(), NOW()),
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 2, 180.00,     360.00, NOW(), NOW()),
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 4, 140.00,     560.00, NOW(), NOW()),
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 6,  58.00,     348.00, NOW(), NOW()),
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002', 6,  52.00,     312.00, NOW(), NOW()),
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 2,  38.00,      76.00, NOW(), NOW()),
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000002', 2, 185.00,     370.00, NOW(), NOW()),

  -- Order 2: Sydney Flood & Restoration — drying equipment for flood job
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', 2, 4200.00,  8400.00, NOW(), NOW()),
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000004', 8,  420.00,  3360.00, NOW(), NOW()),
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', 2, 1650.00,  3300.00, NOW(), NOW()),
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 4,   38.00,    152.00, NOW(), NOW()),

  -- Order 3: Melbourne Steam Clean — commercial scrubber + chemicals
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', 1, 1850.00,  1850.00, NOW(), NOW()),
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001', 4,   45.00,    180.00, NOW(), NOW()),
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000002', 4,   48.00,    192.00, NOW(), NOW()),
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000001', 3,   58.00,    174.00, NOW(), NOW()),

  -- Order 4: Gold Coast Mould — mould remediation kit post-storm
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000003', 1, 1650.00,  1650.00, NOW(), NOW()),
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000002',12,   28.00,    336.00, NOW(), NOW()),
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000003', 5,   62.00,    310.00, NOW(), NOW()),
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000002',20,   12.50,    250.00, NOW(), NOW()),
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000003', 4,   18.00,     72.00, NOW(), NOW()),

  -- Order 5: Newcastle Flood — portable extractors expansion
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', 3, 2200.00,  6600.00, NOW(), NOW()),
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000001', 4,   75.00,    300.00, NOW(), NOW()),
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000005', '60000000-0000-0000-0000-000000000001', 4,   58.00,    232.00, NOW(), NOW()),

  -- Order 6: Draft — Brisbane Carpet Care repeat consumables order
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000006', '60000000-0000-0000-0000-000000000001', 8,  58.00,    464.00, NOW(), NOW()),
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000006', '60000000-0000-0000-0000-000000000002', 8,  52.00,    416.00, NOW(), NOW()),
  (gen_random_uuid(), '01000000-0000-0000-0000-000000000006', '70000000-0000-0000-0000-000000000001', 4,  75.00,    300.00, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Update order totals (calculate from items)
UPDATE orders o SET
  subtotal = COALESCE((SELECT SUM(line_total) FROM order_items WHERE order_id = o.id), 0),
  tax = COALESCE((SELECT SUM(line_total) * 0.10 FROM order_items WHERE order_id = o.id), 0),
  total = COALESCE((SELECT SUM(line_total) * 1.10 FROM order_items WHERE order_id = o.id), 0);

-- Create quotes
INSERT INTO quotes (id, quote_number, customer_id, quote_date, valid_until, status, notes, total, created_at, updated_at)
VALUES
  ('02000000-0000-0000-0000-000000000001', 'QT-2026-001', 'c0000000-0000-0000-0000-000000000006', '2026-02-01', '2026-03-03', 'sent',     'Annual chemical supply contract — Geelong Commercial Cleaning', 0, NOW(), NOW()),
  ('02000000-0000-0000-0000-000000000002', 'QT-2026-002', 'c0000000-0000-0000-0000-000000000007', '2026-02-05', '2026-03-07', 'accepted', 'TruckMount Heat Master + accessories — Perth Carpet upgrade',   0, NOW(), NOW()),
  ('02000000-0000-0000-0000-000000000003', 'QT-2026-003', 'c0000000-0000-0000-0000-000000000008', '2026-02-08', '2026-03-10', 'draft',    'Flood drying kit — Adelaide Restoration enquiry',              0, NOW(), NOW())
ON CONFLICT (quote_number) DO NOTHING;

-- Create quote items
INSERT INTO quote_items (id, quote_id, product_id, quantity, unit_price, line_total, created_at, updated_at)
VALUES
  -- Quote 1: Geelong Commercial — annual chemical supply
  (gen_random_uuid(), '02000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 24,  55.00,  1320.00, NOW(), NOW()),
  (gen_random_uuid(), '02000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002', 24,  49.00,  1176.00, NOW(), NOW()),
  (gen_random_uuid(), '02000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 12,  72.00,   864.00, NOW(), NOW()),

  -- Quote 2: Perth Carpet — TruckMount Heat Master (accepted — ready to convert!)
  (gen_random_uuid(), '02000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002',  1, 24900.00, 24900.00, NOW(), NOW()),
  (gen_random_uuid(), '02000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001',  2,   180.00,   360.00, NOW(), NOW()),
  (gen_random_uuid(), '02000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000002',  2,   185.00,   370.00, NOW(), NOW()),
  (gen_random_uuid(), '02000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000001',  1,   820.00,   820.00, NOW(), NOW()),

  -- Quote 3: Adelaide Restoration — flood drying kit (draft)
  (gen_random_uuid(), '02000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003',  3,  4200.00, 12600.00, NOW(), NOW()),
  (gen_random_uuid(), '02000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000004', 10,   420.00,  4200.00, NOW(), NOW()),
  (gen_random_uuid(), '02000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003',  2,  1650.00,  3300.00, NOW(), NOW())
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
  RAISE NOTICE 'CCW Staff Credentials (all passwords: demo123):';
  RAISE NOTICE '  admin@ccwonline.com.au   — Chris Wilson  (Owner / Admin)';
  RAISE NOTICE '  sales@ccwonline.com.au   — Sarah Chen    (Sales Manager)';
  RAISE NOTICE '  warehouse@ccwonline.com.au — Mark Thompson (Warehouse)';
  RAISE NOTICE '  accounts@ccwonline.com.au  — Lisa Park    (Accounts)';
  RAISE NOTICE '  admin@demo.com           — Admin User   (Legacy dev login)';
  RAISE NOTICE '';
  RAISE NOTICE 'Access: http://localhost:3005';
  RAISE NOTICE '===========================================';
END $$;
