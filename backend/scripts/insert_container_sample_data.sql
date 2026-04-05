-- Container Tracking Sample Data SQL Script
-- Run this script to populate the database with test data

-- Note: This script uses gen_random_uuid() which is available in PostgreSQL with pgcrypto extension
-- If not available, replace with specific UUIDs

-- First, let's create necessary prerequisites if they don't exist

-- Create a test supplier if none exists
INSERT INTO suppliers (id, supplier_code, company_name, contact_name, email, phone, address, city, state, postal_code, country, payment_terms, is_active, created_at, updated_at)
SELECT
    gen_random_uuid(),
    'SUP-TEST-001',
    'Global Equipment Supplies Ltd',
    'John Smith',
    'john.smith@globalequip.com',
    '+86-21-1234-5678',
    '1234 Industrial Road',
    'Shanghai',
    'Shanghai',
    '200000',
    'CN',
    'Net 60',
    true,
    NOW(),
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM suppliers LIMIT 1);

-- Create a test purchase order (link to existing supplier)
INSERT INTO purchase_orders (id, po_number, supplier_id, order_date, delivery_location, status, subtotal, tax, shipping_cost, total, notes, created_at, updated_at)
SELECT
    gen_random_uuid(),
    'PO-2026-' || LPAD((EXTRACT(DAY FROM NOW()))::text, 3, '0'),
    (SELECT id FROM suppliers LIMIT 1),
    NOW() - INTERVAL '30 days',
    'brisbane',
    'confirmed',
    550000.00,
    55000.00,
    15000.00,
    620000.00,
    'Large equipment order for Brisbane warehouse expansion',
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '30 days'
WHERE EXISTS (SELECT 1 FROM suppliers LIMIT 1)
AND NOT EXISTS (SELECT 1 FROM purchase_orders WHERE po_number LIKE 'PO-2026-%' LIMIT 1);

-- Now create the 3 sample containers

-- Container 1: Arriving Soon (7 days)
INSERT INTO containers (
    id,
    container_number,
    purchase_order_id,
    supplier_id,
    vessel_name,
    voyage_number,
    origin_port,
    destination_port,
    destination_warehouse,
    booking_date,
    departure_date,
    estimated_arrival_date,
    status,
    tracking_number,
    carrier,
    shipping_cost,
    notes,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    'MAEU1234567',
    (SELECT id FROM purchase_orders LIMIT 1),
    (SELECT id FROM suppliers LIMIT 1),
    'MSC Diana',
    'DIA-2026-W02',
    'Shanghai, China',
    'Brisbane, Australia',
    'brisbane',
    NOW() - INTERVAL '21 days',
    NOW() - INTERVAL '14 days',
    NOW() + INTERVAL '7 days',
    'in_transit',
    'MAEU1234567890',
    'Maersk',
    8500.00,
    'Large machinery shipment - handle with care',
    NOW() - INTERVAL '21 days',
    NOW()
WHERE EXISTS (SELECT 1 FROM suppliers LIMIT 1)
AND NOT EXISTS (SELECT 1 FROM containers WHERE container_number = 'MAEU1234567');

-- Container 2: At Port (Customs Clearance)
INSERT INTO containers (
    id,
    container_number,
    purchase_order_id,
    supplier_id,
    vessel_name,
    voyage_number,
    origin_port,
    destination_port,
    destination_warehouse,
    booking_date,
    departure_date,
    estimated_arrival_date,
    actual_arrival_date,
    status,
    tracking_number,
    carrier,
    shipping_cost,
    notes,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    'CMAU9876543',
    (SELECT id FROM purchase_orders LIMIT 1),
    (SELECT id FROM suppliers LIMIT 1),
    'CMA CGM Antoine',
    'ANT-2026-W01',
    'Guangzhou, China',
    'Sydney, Australia',
    'sydney',
    NOW() - INTERVAL '28 days',
    NOW() - INTERVAL '21 days',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '1 day',
    'at_port',
    'CMAU9876543210',
    'CMA CGM',
    7200.00,
    'Awaiting customs clearance - documentation in process',
    NOW() - INTERVAL '28 days',
    NOW()
WHERE EXISTS (SELECT 1 FROM suppliers LIMIT 1)
AND NOT EXISTS (SELECT 1 FROM containers WHERE container_number = 'CMAU9876543');

-- Container 3: Overdue (5 days late)
INSERT INTO containers (
    id,
    container_number,
    purchase_order_id,
    supplier_id,
    vessel_name,
    voyage_number,
    origin_port,
    destination_port,
    destination_warehouse,
    booking_date,
    departure_date,
    estimated_arrival_date,
    status,
    tracking_number,
    carrier,
    shipping_cost,
    notes,
    internal_notes,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    'OOLU5555555',
    (SELECT id FROM purchase_orders LIMIT 1),
    (SELECT id FROM suppliers LIMIT 1),
    'OOCL Harmony',
    'HAR-2025-W52',
    'Ningbo, China',
    'Melbourne, Australia',
    'melbourne',
    NOW() - INTERVAL '45 days',
    NOW() - INTERVAL '38 days',
    NOW() - INTERVAL '5 days',
    'in_transit',
    'OOLU5555555555',
    'OOCL',
    9100.00,
    'DELAYED: Weather conditions - vessel rerouted',
    'Contact carrier for updated ETA - customer notified of delay',
    NOW() - INTERVAL '45 days',
    NOW()
WHERE EXISTS (SELECT 1 FROM suppliers LIMIT 1)
AND NOT EXISTS (SELECT 1 FROM containers WHERE container_number = 'OOLU5555555');

-- Now add container items for each container
-- We'll use the existing products from your database

-- Container 1 Items (Arriving Soon)
INSERT INTO container_items (
    id,
    container_id,
    product_id,
    quantity_ordered,
    quantity_preallocated,
    unit_cost,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    (SELECT id FROM containers WHERE container_number = 'MAEU1234567'),
    p.id,
    quantity,
    preallocated,
    cost,
    NOW(),
    NOW()
FROM (
    VALUES
        ((SELECT id FROM products WHERE sku = 'EXC-001'), 3, 1, 120000.00),
        ((SELECT id FROM products WHERE sku = 'EXC-002'), 5, 2, 45000.00),
        ((SELECT id FROM products WHERE sku = 'DRILL-001'), 10, 0, 150.00)
) AS items(product_id, quantity, preallocated, cost)
CROSS JOIN (SELECT id FROM products WHERE sku IN ('EXC-001', 'EXC-002', 'DRILL-001') LIMIT 1) p
WHERE EXISTS (SELECT 1 FROM containers WHERE container_number = 'MAEU1234567')
AND NOT EXISTS (
    SELECT 1 FROM container_items ci
    WHERE ci.container_id = (SELECT id FROM containers WHERE container_number = 'MAEU1234567')
);

-- Container 2 Items (At Port)
INSERT INTO container_items (
    id,
    container_id,
    product_id,
    quantity_ordered,
    quantity_preallocated,
    unit_cost,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    (SELECT id FROM containers WHERE container_number = 'CMAU9876543'),
    p.id,
    quantity,
    preallocated,
    cost,
    NOW(),
    NOW()
FROM (
    VALUES
        ((SELECT id FROM products WHERE sku = 'DRILL-002'), 15, 5, 180.00),
        ((SELECT id FROM products WHERE sku = 'SAW-001'), 20, 8, 95.00)
) AS items(product_id, quantity, preallocated, cost)
CROSS JOIN (SELECT id FROM products WHERE sku IN ('DRILL-002', 'SAW-001') LIMIT 1) p
WHERE EXISTS (SELECT 1 FROM containers WHERE container_number = 'CMAU9876543')
AND NOT EXISTS (
    SELECT 1 FROM container_items ci
    WHERE ci.container_id = (SELECT id FROM containers WHERE container_number = 'CMAU9876543')
);

-- Container 3 Items (Overdue)
INSERT INTO container_items (
    id,
    container_id,
    product_id,
    quantity_ordered,
    quantity_preallocated,
    unit_cost,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    (SELECT id FROM containers WHERE container_number = 'OOLU5555555'),
    p.id,
    quantity,
    preallocated,
    cost,
    NOW(),
    NOW()
FROM (
    VALUES
        ((SELECT id FROM products WHERE sku = 'EXC-001'), 2, 2, 120000.00),
        ((SELECT id FROM products WHERE sku = 'EXC-002'), 4, 3, 45000.00),
        ((SELECT id FROM products WHERE sku = 'DRILL-001'), 12, 0, 150.00)
) AS items(product_id, quantity, preallocated, cost)
CROSS JOIN (SELECT id FROM products WHERE sku IN ('EXC-001', 'EXC-002', 'DRILL-001') LIMIT 1) p
WHERE EXISTS (SELECT 1 FROM containers WHERE container_number = 'OOLU5555555')
AND NOT EXISTS (
    SELECT 1 FROM container_items ci
    WHERE ci.container_id = (SELECT id FROM containers WHERE container_number = 'OOLU5555555')
);

-- Create sample backorders (these will be linked to orders if they exist)
-- Backorder 1: Pending (no container yet)
INSERT INTO backorders (
    id,
    order_id,
    product_id,
    customer_id,
    quantity_backordered,
    quantity_fulfilled,
    fulfillment_location,
    original_order_date,
    status,
    priority,
    notes,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    COALESCE((SELECT id FROM orders LIMIT 1), gen_random_uuid()),
    (SELECT id FROM products WHERE sku = 'EXC-001'),
    (SELECT customer_id FROM orders LIMIT 1),
    2,
    0,
    'brisbane',
    NOW() - INTERVAL '10 days',
    'pending',
    3,
    'Customer requesting expedited delivery when available',
    NOW() - INTERVAL '10 days',
    NOW()
WHERE EXISTS (SELECT 1 FROM products WHERE sku = 'EXC-001')
AND NOT EXISTS (
    SELECT 1 FROM backorders
    WHERE product_id = (SELECT id FROM products WHERE sku = 'EXC-001')
    AND status = 'pending'
);

-- Backorder 2: Allocated to arriving container
INSERT INTO backorders (
    id,
    order_id,
    product_id,
    customer_id,
    quantity_backordered,
    quantity_fulfilled,
    fulfillment_location,
    container_id,
    expected_availability_date,
    original_order_date,
    status,
    customer_notified,
    last_notification_date,
    notification_count,
    priority,
    notes,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    COALESCE((SELECT id FROM orders OFFSET 1 LIMIT 1), gen_random_uuid()),
    (SELECT id FROM products WHERE sku = 'EXC-002'),
    (SELECT customer_id FROM orders OFFSET 1 LIMIT 1),
    3,
    0,
    'brisbane',
    (SELECT id FROM containers WHERE container_number = 'MAEU1234567'),
    (SELECT estimated_arrival_date FROM containers WHERE container_number = 'MAEU1234567'),
    NOW() - INTERVAL '15 days',
    'allocated',
    true,
    NOW() - INTERVAL '2 days',
    1,
    5,
    'Customer notified of ETA - equipment critical for project',
    NOW() - INTERVAL '15 days',
    NOW()
WHERE EXISTS (SELECT 1 FROM products WHERE sku = 'EXC-002')
AND EXISTS (SELECT 1 FROM containers WHERE container_number = 'MAEU1234567')
AND NOT EXISTS (
    SELECT 1 FROM backorders
    WHERE product_id = (SELECT id FROM products WHERE sku = 'EXC-002')
    AND container_id = (SELECT id FROM containers WHERE container_number = 'MAEU1234567')
);

-- Backorder 3: Overdue (linked to delayed container)
INSERT INTO backorders (
    id,
    order_id,
    product_id,
    customer_id,
    quantity_backordered,
    quantity_fulfilled,
    fulfillment_location,
    container_id,
    expected_availability_date,
    original_order_date,
    status,
    customer_notified,
    last_notification_date,
    notification_count,
    priority,
    notes,
    internal_notes,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    COALESCE((SELECT id FROM orders OFFSET 2 LIMIT 1), gen_random_uuid()),
    (SELECT id FROM products WHERE sku = 'EXC-001'),
    (SELECT customer_id FROM orders OFFSET 2 LIMIT 1),
    2,
    0,
    'melbourne',
    (SELECT id FROM containers WHERE container_number = 'OOLU5555555'),
    (SELECT estimated_arrival_date FROM containers WHERE container_number = 'OOLU5555555'),
    NOW() - INTERVAL '20 days',
    'allocated',
    true,
    NOW() - INTERVAL '1 day',
    3,
    8,
    'URGENT - Customer called multiple times. Provide daily updates.',
    'Consider air freight alternative if container delayed further',
    NOW() - INTERVAL '20 days',
    NOW()
WHERE EXISTS (SELECT 1 FROM products WHERE sku = 'EXC-001')
AND EXISTS (SELECT 1 FROM containers WHERE container_number = 'OOLU5555555')
AND NOT EXISTS (
    SELECT 1 FROM backorders
    WHERE product_id = (SELECT id FROM products WHERE sku = 'EXC-001')
    AND container_id = (SELECT id FROM containers WHERE container_number = 'OOLU5555555')
);

-- Summary
SELECT
    'Sample Data Created Successfully!' as message,
    (SELECT COUNT(*) FROM containers WHERE container_number IN ('MAEU1234567', 'CMAU9876543', 'OOLU5555555')) as containers_created,
    (SELECT COUNT(*) FROM container_items WHERE container_id IN (SELECT id FROM containers WHERE container_number IN ('MAEU1234567', 'CMAU9876543', 'OOLU5555555'))) as container_items_created,
    (SELECT COUNT(*) FROM backorders WHERE created_at > NOW() - INTERVAL '1 minute') as backorders_created;
