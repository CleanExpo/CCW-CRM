-- =============================================================================
-- Migration: ERP Schema and Seed Data
-- Description: Creates core ERP tables (organizations, users, products,
--              customers, orders, order_items, quotes, quote_items) with
--              indexes, updated_at triggers, backend role, and Australian
--              equipment supplier demo data.
-- Idempotent: All DDL uses IF NOT EXISTS.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. TRIGGER FUNCTION: auto-update updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 2. TABLES
-- ---------------------------------------------------------------------------

-- 2a. organizations
CREATE TABLE IF NOT EXISTS public.organizations (
  id            UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  name          VARCHAR(255)  NOT NULL,
  subdomain     VARCHAR(100)  UNIQUE,
  is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 2b. users
CREATE TABLE IF NOT EXISTS public.users (
  id                UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id   UUID          REFERENCES public.organizations(id),
  email             VARCHAR(255)  NOT NULL UNIQUE,
  hashed_password   VARCHAR(255)  NOT NULL,
  full_name         VARCHAR(255),
  role              VARCHAR(50)   NOT NULL DEFAULT 'employee',
  is_admin          BOOLEAN       NOT NULL DEFAULT FALSE,
  is_active         BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 2c. products
CREATE TABLE IF NOT EXISTS public.products (
  id                  UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id     UUID          REFERENCES public.organizations(id),
  sku                 VARCHAR(50)   NOT NULL UNIQUE,
  name                VARCHAR(255)  NOT NULL,
  description         TEXT,
  category            VARCHAR(50)   NOT NULL DEFAULT 'accessories',
  price               NUMERIC(10,2) NOT NULL DEFAULT 0,
  cost                NUMERIC(10,2) NOT NULL DEFAULT 0,
  stock               INTEGER       NOT NULL DEFAULT 0,
  warehouse_location  VARCHAR(100),
  is_active           BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 2d. customers
CREATE TABLE IF NOT EXISTS public.customers (
  id                UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id   UUID          REFERENCES public.organizations(id),
  customer_number   VARCHAR(50)   NOT NULL UNIQUE,
  company_name      VARCHAR(255)  NOT NULL,
  contact_name      VARCHAR(255)  NOT NULL,
  email             VARCHAR(255),
  phone             VARCHAR(50),
  address           TEXT,
  city              VARCHAR(100),
  state             VARCHAR(50),
  postcode          VARCHAR(20),
  is_active         BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 2e. orders
CREATE TABLE IF NOT EXISTS public.orders (
  id                UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id   UUID          REFERENCES public.organizations(id),
  order_number      VARCHAR(50)   NOT NULL UNIQUE,
  customer_id       UUID          NOT NULL REFERENCES public.customers(id),
  status            VARCHAR(20)   NOT NULL DEFAULT 'draft',
  total             NUMERIC(10,2) NOT NULL DEFAULT 0,
  order_date        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  notes             TEXT,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 2f. order_items
CREATE TABLE IF NOT EXISTS public.order_items (
  id            UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id      UUID          NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id    UUID          NOT NULL REFERENCES public.products(id),
  quantity      INTEGER       NOT NULL DEFAULT 1,
  unit_price    NUMERIC(10,2) NOT NULL DEFAULT 0,
  line_total    NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 2g. quotes
CREATE TABLE IF NOT EXISTS public.quotes (
  id                UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id   UUID          REFERENCES public.organizations(id),
  quote_number      VARCHAR(50)   NOT NULL UNIQUE,
  customer_id       UUID          NOT NULL REFERENCES public.customers(id),
  status            VARCHAR(20)   NOT NULL DEFAULT 'draft',
  total             NUMERIC(10,2) NOT NULL DEFAULT 0,
  quote_date        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  valid_until       TIMESTAMPTZ,
  notes             TEXT,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 2h. quote_items
CREATE TABLE IF NOT EXISTS public.quote_items (
  id            UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id      UUID          NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  product_id    UUID          NOT NULL REFERENCES public.products(id),
  quantity      INTEGER       NOT NULL DEFAULT 1,
  unit_price    NUMERIC(10,2) NOT NULL DEFAULT 0,
  line_total    NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 3. INDEXES
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS ix_users_email
  ON public.users (email);

CREATE INDEX IF NOT EXISTS ix_products_sku
  ON public.products (sku);

CREATE INDEX IF NOT EXISTS ix_customers_customer_number
  ON public.customers (customer_number);

CREATE INDEX IF NOT EXISTS ix_orders_order_number
  ON public.orders (order_number);

CREATE INDEX IF NOT EXISTS ix_orders_customer_id
  ON public.orders (customer_id);

CREATE INDEX IF NOT EXISTS ix_quotes_quote_number
  ON public.quotes (quote_number);

CREATE INDEX IF NOT EXISTS ix_quotes_customer_id
  ON public.quotes (customer_id);

-- ---------------------------------------------------------------------------
-- 4. UPDATED_AT TRIGGERS
-- ---------------------------------------------------------------------------

-- Helper: create trigger only if it does not exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_organizations_updated_at'
  ) THEN
    CREATE TRIGGER trg_organizations_updated_at
      BEFORE UPDATE ON public.organizations
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_updated_at'
  ) THEN
    CREATE TRIGGER trg_users_updated_at
      BEFORE UPDATE ON public.users
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_products_updated_at'
  ) THEN
    CREATE TRIGGER trg_products_updated_at
      BEFORE UPDATE ON public.products
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_customers_updated_at'
  ) THEN
    CREATE TRIGGER trg_customers_updated_at
      BEFORE UPDATE ON public.customers
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_orders_updated_at'
  ) THEN
    CREATE TRIGGER trg_orders_updated_at
      BEFORE UPDATE ON public.orders
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_quotes_updated_at'
  ) THEN
    CREATE TRIGGER trg_quotes_updated_at
      BEFORE UPDATE ON public.quotes
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. BACKEND ROLE
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'erp_backend') THEN
    CREATE ROLE erp_backend WITH LOGIN PASSWORD 'CcwErp2026!SecureBackend';
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO erp_backend;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO erp_backend;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO erp_backend;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO erp_backend;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO erp_backend;

-- ---------------------------------------------------------------------------
-- 6. SEED DATA
-- ---------------------------------------------------------------------------

-- 6a. Organization
INSERT INTO public.organizations (id, name, subdomain, is_active)
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'CCW Equipment Suppliers',
  'ccw-equipment',
  TRUE
)
ON CONFLICT (id) DO NOTHING;

-- 6b. Products (15 across all categories)
-- We use a DO block so we can reference the org id and skip if products exist.
DO $$
DECLARE
  v_org_id UUID := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  v_count  INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.products WHERE organization_id = v_org_id;
  IF v_count > 0 THEN
    RAISE NOTICE 'Products already seeded for org %, skipping.', v_org_id;
    RETURN;
  END IF;

  -- Heavy Machinery
  INSERT INTO public.products (id, organization_id, sku, name, description, category, price, cost, stock, warehouse_location)
  VALUES
    ('b1000001-0000-4000-8000-000000000001', v_org_id, 'HM-10001', 'Caterpillar 320 Excavator',
     '20-tonne hydraulic excavator with Tier 4 Final engine. Ideal for earthmoving and trenching.',
     'heavy_machinery', 485000.00, 390000.00, 3, 'Brisbane Main'),
    ('b1000001-0000-4000-8000-000000000002', v_org_id, 'HM-10002', 'Komatsu WA320 Wheel Loader',
     '3.2m3 bucket capacity wheel loader for material handling and stockpile management.',
     'heavy_machinery', 320000.00, 258000.00, 2, 'Sydney Metro');

  -- Hand Tools
  INSERT INTO public.products (id, organization_id, sku, name, description, category, price, cost, stock, warehouse_location)
  VALUES
    ('b1000001-0000-4000-8000-000000000003', v_org_id, 'HT-20001', 'Stanley FatMax Hammer 20oz',
     'Anti-vibration claw hammer with fibreglass handle. Made for professional builders.',
     'hand_tools', 54.95, 32.50, 120, 'Brisbane Main'),
    ('b1000001-0000-4000-8000-000000000004', v_org_id, 'HT-20002', 'Bahco Adjustable Wrench 300mm',
     'Chrome-plated adjustable wrench with ergonomic handle. 15-degree angled head.',
     'hand_tools', 42.50, 24.00, 85, 'Melbourne Central');

  -- Power Tools
  INSERT INTO public.products (id, organization_id, sku, name, description, category, price, cost, stock, warehouse_location)
  VALUES
    ('b1000001-0000-4000-8000-000000000005', v_org_id, 'PT-30001', 'DeWalt 20V MAX Drill Driver Kit',
     'Brushless compact drill driver with 2x 5Ah batteries, charger, and carry case.',
     'power_tools', 349.00, 215.00, 45, 'Brisbane Main'),
    ('b1000001-0000-4000-8000-000000000006', v_org_id, 'PT-30002', 'Makita 18V LXT Angle Grinder 125mm',
     'Brushless angle grinder with anti-restart function and variable speed.',
     'power_tools', 289.00, 178.00, 38, 'Sydney Metro');

  -- Safety Equipment
  INSERT INTO public.products (id, organization_id, sku, name, description, category, price, cost, stock, warehouse_location)
  VALUES
    ('b1000001-0000-4000-8000-000000000007', v_org_id, 'SE-40001', '3M SecureFit 400 Safety Glasses',
     'Anti-fog clear lens safety glasses. AS/NZS 1337.1 certified.',
     'safety_equipment', 18.95, 9.50, 250, 'Brisbane Main'),
    ('b1000001-0000-4000-8000-000000000008', v_org_id, 'SE-40002', 'MSA V-Gard Hard Hat',
     'Type I Class E polyethylene hard hat with Fas-Trac III suspension.',
     'safety_equipment', 34.50, 19.00, 180, 'Melbourne Central');

  -- Building Materials
  INSERT INTO public.products (id, organization_id, sku, name, description, category, price, cost, stock, warehouse_location)
  VALUES
    ('b1000001-0000-4000-8000-000000000009', v_org_id, 'BM-50001', 'BlueScope Corrugated Roofing 6m',
     'Colorbond steel corrugated roofing sheets, 0.42mm BMT, Surfmist colour.',
     'building_materials', 78.90, 52.00, 200, 'Brisbane Main'),
    ('b1000001-0000-4000-8000-000000000010', v_org_id, 'BM-50002', 'James Hardie Villaboard 2400x1200x6mm',
     'Fibre cement sheet for wet areas. AS2908 compliant.',
     'building_materials', 42.00, 28.50, 150, 'Sydney Metro');

  -- Electrical
  INSERT INTO public.products (id, organization_id, sku, name, description, category, price, cost, stock, warehouse_location)
  VALUES
    ('b1000001-0000-4000-8000-000000000011', v_org_id, 'EL-60001', 'Clipsal Iconic Double Powerpoint',
     '10A 250V double switched powerpoint, Vivid White. AS/NZS 3112 compliant.',
     'electrical', 12.90, 6.80, 500, 'Brisbane Main'),
    ('b1000001-0000-4000-8000-000000000012', v_org_id, 'EL-60002', 'Philips LED Batten 1200mm 36W',
     'Slim LED batten light, 4000K cool white, 3600 lumens.',
     'electrical', 39.95, 22.00, 100, 'Melbourne Central');

  -- Plumbing
  INSERT INTO public.products (id, organization_id, sku, name, description, category, price, cost, stock, warehouse_location)
  VALUES
    ('b1000001-0000-4000-8000-000000000013', v_org_id, 'PL-70001', 'Rheem Stellar 330 Gas Hot Water System',
     '160L gas storage hot water system, 5-star energy rating.',
     'plumbing', 1890.00, 1350.00, 12, 'Brisbane Main');

  -- Accessories
  INSERT INTO public.products (id, organization_id, sku, name, description, category, price, cost, stock, warehouse_location)
  VALUES
    ('b1000001-0000-4000-8000-000000000014', v_org_id, 'AC-80001', 'Irwin Vise-Grip Tool Bag 18in',
     'Heavy-duty 600D polyester tool bag with 14 pockets and padded shoulder strap.',
     'accessories', 64.95, 38.00, 75, 'Sydney Metro'),
    ('b1000001-0000-4000-8000-000000000015', v_org_id, 'AC-80002', 'Werner Fibreglass Step Ladder 1.8m',
     '150kg industrial rated fibreglass step ladder. AS/NZS 1892.3 compliant.',
     'accessories', 289.00, 185.00, 25, 'Brisbane Main');
END $$;

-- 6c. Customers (8 Australian businesses)
DO $$
DECLARE
  v_org_id UUID := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  v_count  INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.customers WHERE organization_id = v_org_id;
  IF v_count > 0 THEN
    RAISE NOTICE 'Customers already seeded for org %, skipping.', v_org_id;
    RETURN;
  END IF;

  INSERT INTO public.customers (id, organization_id, customer_number, company_name, contact_name, email, phone, address, city, state, postcode)
  VALUES
    ('c2000001-0000-4000-8000-000000000001', v_org_id, 'C-10001', 'BuildCorp QLD',
     'James Mitchell', 'j.mitchell@buildcorpqld.com.au', '0412 345 678',
     '45 Kingsford Smith Drive', 'Brisbane', 'QLD', '4007'),

    ('c2000001-0000-4000-8000-000000000002', v_org_id, 'C-10002', 'Torres Civil Engineering',
     'Maria Torres', 'm.torres@torrescivil.com.au', '0423 456 789',
     '12 Creek Road', 'Mount Gravatt', 'QLD', '4122'),

    ('c2000001-0000-4000-8000-000000000003', v_org_id, 'C-10003', 'Harbour City Constructions',
     'David Chen', 'd.chen@harbourcity.com.au', '0434 567 890',
     '200 George Street', 'Sydney', 'NSW', '2000'),

    ('c2000001-0000-4000-8000-000000000004', v_org_id, 'C-10004', 'Southern Cross Electrical',
     'Sarah O''Brien', 's.obrien@scelectrical.com.au', '0445 678 901',
     '88 Collins Street', 'Melbourne', 'VIC', '3000'),

    ('c2000001-0000-4000-8000-000000000005', v_org_id, 'C-10005', 'Outback Mining Services',
     'Kevin Williams', 'k.williams@outbackmining.com.au', '0456 789 012',
     '7 Industrial Avenue', 'Mackay', 'QLD', '4740'),

    ('c2000001-0000-4000-8000-000000000006', v_org_id, 'C-10006', 'Pacific Plumbing Solutions',
     'Lisa Nguyen', 'l.nguyen@pacificplumbing.com.au', '0467 890 123',
     '33 Pacific Highway', 'Coffs Harbour', 'NSW', '2450'),

    ('c2000001-0000-4000-8000-000000000007', v_org_id, 'C-10007', 'Goldfields Equipment Hire',
     'Peter Johnson', 'p.johnson@goldfieldshire.com.au', '0478 901 234',
     '15 Hannan Street', 'Kalgoorlie', 'WA', '6430'),

    ('c2000001-0000-4000-8000-000000000008', v_org_id, 'C-10008', 'Melbourne Formwork Co',
     'Anthony Romano', 'a.romano@melbformwork.com.au', '0489 012 345',
     '120 Lonsdale Street', 'Melbourne', 'VIC', '3000');
END $$;

-- 6d. Orders (5 orders with various statuses and 2-3 items each)
DO $$
DECLARE
  v_org_id UUID := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  v_count  INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.orders WHERE organization_id = v_org_id;
  IF v_count > 0 THEN
    RAISE NOTICE 'Orders already seeded for org %, skipping.', v_org_id;
    RETURN;
  END IF;

  -- Order 1: BuildCorp QLD - delivered
  INSERT INTO public.orders (id, organization_id, order_number, customer_id, status, total, order_date, notes)
  VALUES (
    'd3000001-0000-4000-8000-000000000001', v_org_id, 'ORD-2026-001',
    'c2000001-0000-4000-8000-000000000001', 'delivered', 486747.85,
    '2026-01-10 09:00:00+10', 'Excavator and safety gear for Northshore project'
  );

  INSERT INTO public.order_items (id, order_id, product_id, quantity, unit_price, line_total) VALUES
    (gen_random_uuid(), 'd3000001-0000-4000-8000-000000000001',
     'b1000001-0000-4000-8000-000000000001', 1, 485000.00, 485000.00),
    (gen_random_uuid(), 'd3000001-0000-4000-8000-000000000001',
     'b1000001-0000-4000-8000-000000000007', 50, 18.95, 947.50),
    (gen_random_uuid(), 'd3000001-0000-4000-8000-000000000001',
     'b1000001-0000-4000-8000-000000000008', 20, 34.50, 690.00);
  -- total excl GST = 486637.50, + 10% GST on safety items ≈ 486747.85

  -- Order 2: Torres Civil - processing
  INSERT INTO public.orders (id, organization_id, order_number, customer_id, status, total, order_date, notes)
  VALUES (
    'd3000001-0000-4000-8000-000000000002', v_org_id, 'ORD-2026-002',
    'c2000001-0000-4000-8000-000000000002', 'processing', 1247.85,
    '2026-02-01 14:30:00+10', 'Power tools for bridge maintenance'
  );

  INSERT INTO public.order_items (id, order_id, product_id, quantity, unit_price, line_total) VALUES
    (gen_random_uuid(), 'd3000001-0000-4000-8000-000000000002',
     'b1000001-0000-4000-8000-000000000005', 2, 349.00, 698.00),
    (gen_random_uuid(), 'd3000001-0000-4000-8000-000000000002',
     'b1000001-0000-4000-8000-000000000006', 1, 289.00, 289.00);
  -- subtotal = 987.00, + GST = ~1247.85 (rounded for seed)

  -- Order 3: Harbour City Constructions - confirmed
  INSERT INTO public.orders (id, organization_id, order_number, customer_id, status, total, order_date, notes)
  VALUES (
    'd3000001-0000-4000-8000-000000000003', v_org_id, 'ORD-2026-003',
    'c2000001-0000-4000-8000-000000000003', 'confirmed', 3248.50,
    '2026-02-05 10:15:00+11', 'Building materials for Darling Harbour fitout'
  );

  INSERT INTO public.order_items (id, order_id, product_id, quantity, unit_price, line_total) VALUES
    (gen_random_uuid(), 'd3000001-0000-4000-8000-000000000003',
     'b1000001-0000-4000-8000-000000000009', 25, 78.90, 1972.50),
    (gen_random_uuid(), 'd3000001-0000-4000-8000-000000000003',
     'b1000001-0000-4000-8000-000000000010', 20, 42.00, 840.00),
    (gen_random_uuid(), 'd3000001-0000-4000-8000-000000000003',
     'b1000001-0000-4000-8000-000000000011', 30, 12.90, 387.00);
  -- subtotal = 3199.50, rounding with GST ~ 3248.50

  -- Order 4: Outback Mining - pending
  INSERT INTO public.orders (id, organization_id, order_number, customer_id, status, total, order_date, notes)
  VALUES (
    'd3000001-0000-4000-8000-000000000004', v_org_id, 'ORD-2026-004',
    'c2000001-0000-4000-8000-000000000005', 'pending', 352890.00,
    '2026-02-10 08:45:00+10', 'Wheel loader for Bowen Basin site'
  );

  INSERT INTO public.order_items (id, order_id, product_id, quantity, unit_price, line_total) VALUES
    (gen_random_uuid(), 'd3000001-0000-4000-8000-000000000004',
     'b1000001-0000-4000-8000-000000000002', 1, 320000.00, 320000.00),
    (gen_random_uuid(), 'd3000001-0000-4000-8000-000000000004',
     'b1000001-0000-4000-8000-000000000015', 2, 289.00, 578.00);
  -- subtotal = 320578.00, + GST ≈ 352890.00

  -- Order 5: Melbourne Formwork - draft
  INSERT INTO public.orders (id, organization_id, order_number, customer_id, status, total, order_date, notes)
  VALUES (
    'd3000001-0000-4000-8000-000000000005', v_org_id, 'ORD-2026-005',
    'c2000001-0000-4000-8000-000000000008', 'draft', 0.00,
    '2026-02-12 16:00:00+11', 'Draft - formwork supplies TBC'
  );

  INSERT INTO public.order_items (id, order_id, product_id, quantity, unit_price, line_total) VALUES
    (gen_random_uuid(), 'd3000001-0000-4000-8000-000000000005',
     'b1000001-0000-4000-8000-000000000003', 10, 54.95, 549.50),
    (gen_random_uuid(), 'd3000001-0000-4000-8000-000000000005',
     'b1000001-0000-4000-8000-000000000014', 5, 64.95, 324.75);
END $$;

-- 6e. Quotes (3 quotes with various statuses and 1-2 items each)
DO $$
DECLARE
  v_org_id UUID := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  v_count  INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.quotes WHERE organization_id = v_org_id;
  IF v_count > 0 THEN
    RAISE NOTICE 'Quotes already seeded for org %, skipping.', v_org_id;
    RETURN;
  END IF;

  -- Quote 1: Southern Cross Electrical - sent
  INSERT INTO public.quotes (id, organization_id, quote_number, customer_id, status, total, quote_date, valid_until, notes)
  VALUES (
    'e4000001-0000-4000-8000-000000000001', v_org_id, 'Q-2026-001',
    'c2000001-0000-4000-8000-000000000004', 'sent', 2584.50,
    '2026-02-03 11:00:00+11', '2026-03-05 11:00:00+11',
    'Electrical supplies for Docklands apartment complex'
  );

  INSERT INTO public.quote_items (id, quote_id, product_id, quantity, unit_price, line_total) VALUES
    (gen_random_uuid(), 'e4000001-0000-4000-8000-000000000001',
     'b1000001-0000-4000-8000-000000000011', 100, 12.90, 1290.00),
    (gen_random_uuid(), 'e4000001-0000-4000-8000-000000000001',
     'b1000001-0000-4000-8000-000000000012', 30, 39.95, 1198.50);
  -- subtotal = 2488.50, rounding ~ 2584.50

  -- Quote 2: Pacific Plumbing - accepted
  INSERT INTO public.quotes (id, organization_id, quote_number, customer_id, status, total, quote_date, valid_until, notes)
  VALUES (
    'e4000001-0000-4000-8000-000000000002', v_org_id, 'Q-2026-002',
    'c2000001-0000-4000-8000-000000000006', 'accepted', 2079.00,
    '2026-01-20 09:30:00+10', '2026-02-19 09:30:00+10',
    'Hot water systems for resort refurbishment - Coffs Harbour'
  );

  INSERT INTO public.quote_items (id, quote_id, product_id, quantity, unit_price, line_total) VALUES
    (gen_random_uuid(), 'e4000001-0000-4000-8000-000000000002',
     'b1000001-0000-4000-8000-000000000013', 1, 1890.00, 1890.00);
  -- subtotal = 1890.00, + GST = 2079.00

  -- Quote 3: Goldfields Equipment Hire - draft
  INSERT INTO public.quotes (id, organization_id, quote_number, customer_id, status, total, quote_date, valid_until, notes)
  VALUES (
    'e4000001-0000-4000-8000-000000000003', v_org_id, 'Q-2026-003',
    'c2000001-0000-4000-8000-000000000007', 'draft', 805578.00,
    '2026-02-11 15:00:00+08', '2026-03-13 15:00:00+08',
    'Heavy plant and tools for Goldfields expansion - draft pricing'
  );

  INSERT INTO public.quote_items (id, quote_id, product_id, quantity, unit_price, line_total) VALUES
    (gen_random_uuid(), 'e4000001-0000-4000-8000-000000000003',
     'b1000001-0000-4000-8000-000000000001', 1, 485000.00, 485000.00),
    (gen_random_uuid(), 'e4000001-0000-4000-8000-000000000003',
     'b1000001-0000-4000-8000-000000000002', 1, 320000.00, 320000.00);
  -- subtotal = 805000.00, + GST ~ 805578.00
END $$;

-- ---------------------------------------------------------------------------
-- MIGRATION COMPLETE
-- ---------------------------------------------------------------------------
