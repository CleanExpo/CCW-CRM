"""Seed database with sample ERP data."""
import os
import asyncio
import asyncpg
from dotenv import load_dotenv
from datetime import datetime, timedelta
import random

load_dotenv()

async def seed_database():
    """Seed the database with sample data."""
    database_url = os.getenv("DATABASE_URL")
    conn = await asyncpg.connect(database_url)

    try:
        print("Starting database seeding...")

        # Create or get organization
        print("\n1. Checking organization...")
        org_id = await conn.fetchval("""
            SELECT id FROM organizations WHERE subdomain = 'ccw'
        """)

        if org_id:
            print(f"   Organization already exists: {org_id}")
            print("   Clearing existing seed data to re-seed...")

            # Delete in reverse order of dependencies
            await conn.execute("DELETE FROM product_stock_by_location")
            await conn.execute("DELETE FROM stock_reservations")
            await conn.execute("DELETE FROM stock_adjustments")
            await conn.execute("DELETE FROM stock_transfers")
            await conn.execute("DELETE FROM inbound_shipments")
            await conn.execute("DELETE FROM outbound_shipments")
            await conn.execute("DELETE FROM purchase_order_items")
            await conn.execute("DELETE FROM purchase_orders")
            await conn.execute("DELETE FROM order_items")
            await conn.execute("DELETE FROM orders")
            await conn.execute("DELETE FROM quote_items")
            await conn.execute("DELETE FROM quotes")
            await conn.execute("DELETE FROM service_requests")
            await conn.execute("DELETE FROM products")
            await conn.execute("DELETE FROM customers")
            await conn.execute("DELETE FROM suppliers")
            await conn.execute("DELETE FROM users WHERE organization_id = $1", org_id)
            print("   Cleared existing data")
        else:
            org_id = await conn.fetchval("""
                INSERT INTO organizations (name, subdomain, is_active)
                VALUES ('CCW Equipment Supplies', 'ccw', true)
                RETURNING id
            """)
            print(f"   Created organization: {org_id}")

        # Create users
        print("\n2. Creating users...")
        # Pre-hashed password for "password123" using bcrypt
        # Generated with: bcrypt.hashpw(b"password123", bcrypt.gensalt())
        hashed_password = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5lZJ.UpL7mqWy"

        admin_id = await conn.fetchval("""
            INSERT INTO users (organization_id, email, hashed_password, full_name, role, is_admin, is_active)
            VALUES ($1, 'admin@ccw.com', $2, 'Admin User', 'admin', true, true)
            RETURNING id
        """, org_id, hashed_password)
        print(f"   Created admin user: admin@ccw.com")

        manager_id = await conn.fetchval("""
            INSERT INTO users (organization_id, email, hashed_password, full_name, role, is_admin, is_active)
            VALUES ($1, 'manager@ccw.com', $2, 'Sales Manager', 'manager', false, true)
            RETURNING id
        """, org_id, hashed_password)
        print(f"   Created manager user: manager@ccw.com")

        employee_id = await conn.fetchval("""
            INSERT INTO users (organization_id, email, hashed_password, full_name, role, is_admin, is_active)
            VALUES ($1, 'employee@ccw.com', $2, 'John Smith', 'employee', false, true)
            RETURNING id
        """, org_id, hashed_password)
        print(f"   Created employee user: employee@ccw.com")

        # Create products
        print("\n3. Creating products...")
        products = [
            ('EXC-001', 'Excavator CAT 320', 'Heavy-duty excavator for construction', 'HEAVY_MACHINERY', 125000.00, 95000.00, 2, 'Warehouse A-1'),
            ('EXC-002', 'Mini Excavator Bobcat E20', 'Compact excavator for small sites', 'HEAVY_MACHINERY', 35000.00, 28000.00, 5, 'Warehouse A-2'),
            ('DRILL-001', 'Cordless Drill DeWalt 20V', 'Professional cordless drill', 'POWER_TOOLS', 179.99, 120.00, 45, 'Warehouse B-3'),
            ('DRILL-002', 'Hammer Drill Bosch GSB 18V', 'High-power hammer drill', 'POWER_TOOLS', 249.99, 165.00, 32, 'Warehouse B-3'),
            ('SAW-001', 'Circular Saw Makita 7-1/4"', 'Professional circular saw', 'POWER_TOOLS', 199.99, 135.00, 28, 'Warehouse B-4'),
            ('WRENCH-001', 'Adjustable Wrench Set', 'Professional wrench set 5pc', 'HAND_TOOLS', 89.99, 45.00, 75, 'Warehouse C-1'),
            ('HAMMER-001', 'Framing Hammer', 'Professional framing hammer', 'HAND_TOOLS', 39.99, 18.00, 120, 'Warehouse C-1'),
            ('HELMET-001', 'Safety Helmet Hard Hat', 'ANSI certified safety helmet', 'SAFETY_EQUIPMENT', 24.99, 12.00, 200, 'Warehouse D-1'),
            ('VEST-001', 'High-Vis Safety Vest', 'Class 2 high-visibility vest', 'SAFETY_EQUIPMENT', 19.99, 8.00, 350, 'Warehouse D-2'),
            ('GLOVES-001', 'Work Gloves Heavy Duty', 'Cut-resistant work gloves', 'SAFETY_EQUIPMENT', 15.99, 6.50, 400, 'Warehouse D-3'),
            ('BLADE-001', 'Saw Blade Set', 'Circular saw blade set 10pc', 'ACCESSORIES', 45.99, 22.00, 85, 'Warehouse E-1'),
            ('BITS-001', 'Drill Bit Set', 'HSS drill bit set 29pc', 'ACCESSORIES', 34.99, 15.00, 110, 'Warehouse E-1'),
        ]

        product_ids = {}
        for sku, name, desc, category, price, cost, stock, location in products:
            product_id = await conn.fetchval("""
                INSERT INTO products (organization_id, sku, name, description, category, price, cost, stock, warehouse_location, is_active)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
                RETURNING id
            """, org_id, sku, name, desc, category, price, cost, stock, location)
            product_ids[sku] = product_id
        print(f"   Created {len(products)} products")

        # Create customers
        print("\n4. Creating customers...")
        customers = [
            ('CUST-001', 'ABC Construction Ltd', 'Mike Johnson', 'mike@abcconstruction.com', '555-0101', '123 Builder St', 'Sydney', 'NSW', '2000'),
            ('CUST-002', 'XYZ Contractors', 'Sarah Williams', 'sarah@xyzcontractors.com', '555-0102', '456 Trade Ave', 'Melbourne', 'VIC', '3000'),
            ('CUST-003', 'BuildRight Group', 'Tom Anderson', 'tom@buildright.com', '555-0103', '789 Industry Rd', 'Brisbane', 'QLD', '4000'),
            ('CUST-004', 'Metro Developments', 'Lisa Chen', 'lisa@metrodev.com', '555-0104', '321 Commerce Dr', 'Perth', 'WA', '6000'),
            ('CUST-005', 'Coastal Builders', 'James Taylor', 'james@coastalbuilders.com', '555-0105', '654 Shore Ln', 'Adelaide', 'SA', '5000'),
        ]

        customer_ids = {}
        for cust_num, company, contact, email, phone, address, city, state, postcode in customers:
            customer_id = await conn.fetchval("""
                INSERT INTO customers (organization_id, customer_number, company_name, contact_name, email, phone, address, city, state, postcode, is_active)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
                RETURNING id
            """, org_id, cust_num, company, contact, email, phone, address, city, state, postcode)
            customer_ids[cust_num] = customer_id
        print(f"   Created {len(customers)} customers")

        # Create quotes
        print("\n5. Creating quotes...")
        quote_count = 0

        # Quote 1 - Draft
        quote_date = datetime.now() - timedelta(days=5)
        quote_id = await conn.fetchval("""
            INSERT INTO quotes (organization_id, quote_number, customer_id, status, total, quote_date, valid_until)
            VALUES ($1, 'Q-2026-001', $2, 'draft', 0, $3, $4)
            RETURNING id
        """, org_id, customer_ids['CUST-001'], quote_date, quote_date + timedelta(days=30))

        await conn.execute("""
            INSERT INTO quote_items (quote_id, product_id, quantity, unit_price, line_total)
            VALUES ($1, $2, 2, 179.99, 359.98), ($1, $3, 1, 199.99, 199.99)
        """, quote_id, product_ids['DRILL-001'], product_ids['SAW-001'])

        await conn.execute("""
            UPDATE quotes SET total = (SELECT SUM(line_total) FROM quote_items WHERE quote_id = $1) WHERE id = $1
        """, quote_id)
        quote_count += 1

        # Quote 2 - Sent
        quote_date = datetime.now() - timedelta(days=3)
        quote_id = await conn.fetchval("""
            INSERT INTO quotes (organization_id, quote_number, customer_id, status, total, quote_date, valid_until)
            VALUES ($1, 'Q-2026-002', $2, 'sent', 0, $3, $4)
            RETURNING id
        """, org_id, customer_ids['CUST-002'], quote_date, quote_date + timedelta(days=30))

        await conn.execute("""
            INSERT INTO quote_items (quote_id, product_id, quantity, unit_price, line_total)
            VALUES ($1, $2, 1, 125000.00, 125000.00), ($1, $3, 10, 24.99, 249.90)
        """, quote_id, product_ids['EXC-001'], product_ids['HELMET-001'])

        await conn.execute("""
            UPDATE quotes SET total = (SELECT SUM(line_total) FROM quote_items WHERE quote_id = $1) WHERE id = $1
        """, quote_id)
        quote_count += 1

        print(f"   Created {quote_count} quotes")

        # Create orders
        print("\n6. Creating orders...")
        order_count = 0

        # Order 1 - Delivered
        order_date = datetime.now() - timedelta(days=30)
        order_id = await conn.fetchval("""
            INSERT INTO orders (organization_id, order_number, customer_id, status, total, order_date, notes)
            VALUES ($1, 'ORD-2026-001', $2, 'delivered', 0, $3, 'Delivered on time')
            RETURNING id
        """, org_id, customer_ids['CUST-003'], order_date)

        await conn.execute("""
            INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total)
            VALUES ($1, $2, 5, 179.99, 899.95), ($1, $3, 20, 15.99, 319.80), ($1, $4, 1, 45.99, 45.99)
        """, order_id, product_ids['DRILL-001'], product_ids['GLOVES-001'], product_ids['BLADE-001'])

        await conn.execute("""
            UPDATE orders SET total = (SELECT SUM(line_total) FROM order_items WHERE order_id = $1) WHERE id = $1
        """, order_id)
        order_count += 1

        # Order 2 - Processing
        order_date = datetime.now() - timedelta(days=5)
        order_id = await conn.fetchval("""
            INSERT INTO orders (organization_id, order_number, customer_id, status, total, order_date)
            VALUES ($1, 'ORD-2026-002', $2, 'processing', 0, $3)
            RETURNING id
        """, org_id, customer_ids['CUST-004'], order_date)

        await conn.execute("""
            INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total)
            VALUES ($1, $2, 1, 35000.00, 35000.00), ($1, $3, 5, 19.99, 99.95)
        """, order_id, product_ids['EXC-002'], product_ids['VEST-001'])

        await conn.execute("""
            UPDATE orders SET total = (SELECT SUM(line_total) FROM order_items WHERE order_id = $1) WHERE id = $1
        """, order_id)
        order_count += 1

        # Order 3 - Confirmed
        order_date = datetime.now() - timedelta(days=2)
        order_id = await conn.fetchval("""
            INSERT INTO orders (organization_id, order_number, customer_id, status, total, order_date)
            VALUES ($1, 'ORD-2026-003', $2, 'confirmed', 0, $3)
            RETURNING id
        """, org_id, customer_ids['CUST-005'], order_date)

        await conn.execute("""
            INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total)
            VALUES ($1, $2, 3, 249.99, 749.97), ($1, $3, 2, 89.99, 179.98), ($1, $4, 1, 34.99, 34.99)
        """, order_id, product_ids['DRILL-002'], product_ids['WRENCH-001'], product_ids['BITS-001'])

        await conn.execute("""
            UPDATE orders SET total = (SELECT SUM(line_total) FROM order_items WHERE order_id = $1) WHERE id = $1
        """, order_id)
        order_count += 1

        print(f"   Created {order_count} orders")

        # Create multi-location inventory
        print("\n7. Creating multi-location inventory...")

        # Clear existing multi-location data
        await conn.execute("DELETE FROM product_stock_by_location")

        # Define stock by location for each product
        # Format: (sku, brisbane_stock, sydney_stock, melbourne_stock, reserved_brisbane, reserved_sydney, reserved_melbourne)
        multi_location_stock = [
            # Critical - Industrial Ladder (out of stock everywhere)
            ('SKU-201', 0, 0, 0, 0, 0, 0),

            # Low stock - Safety Helmet (total = 22, distributed)
            ('HELMET-001', 15, 8, 5, 3, 2, 1),

            # Location imbalance - Extension Cord (Brisbane out, others have stock)
            ('SKU-105', 0, 18, 22, 0, 5, 0),

            # High priority transfer candidates
            ('DRILL-001', 45, 6, 12, 0, 0, 0),  # Brisbane surplus, Sydney low
            ('GLOVES-001', 8, 50, 12, 2, 5, 3),  # Sydney surplus, Brisbane low
            ('SAW-001', 22, 4, 25, 0, 1, 0),  # Melbourne surplus, Sydney low

            # Medium priority transfers
            ('DRILL-002', 12, 4, 16, 0, 0, 0),  # Moderate imbalance
            ('WRENCH-001', 25, 8, 30, 0, 2, 0),  # Sydney slightly low

            # Good distribution (no transfers needed)
            ('EXC-001', 1, 1, 0, 0, 0, 0),  # Expensive items, low stock normal
            ('EXC-002', 2, 2, 1, 0, 0, 0),
            ('HAMMER-001', 40, 45, 35, 0, 0, 0),  # Well distributed
            ('VEST-001', 120, 115, 115, 5, 5, 5),  # High stock, well distributed
        ]

        stock_count = 0
        for sku, brisbane, sydney, melbourne, res_bris, res_syd, res_melb in multi_location_stock:
            # Check if product exists with this SKU
            product_id = await conn.fetchval("SELECT id FROM products WHERE sku = $1", sku)

            if not product_id:
                print(f"   Warning: Product {sku} not found, skipping...")
                continue

            # Insert Brisbane location
            await conn.execute("""
                INSERT INTO product_stock_by_location
                (id, product_id, location, stock, reserved, reorder_point, reorder_quantity, created_at, updated_at)
                VALUES (gen_random_uuid(), $1, 'brisbane', $2, $3, 10, 20, NOW(), NOW())
            """, product_id, brisbane, res_bris)

            # Insert Sydney location
            await conn.execute("""
                INSERT INTO product_stock_by_location
                (id, product_id, location, stock, reserved, reorder_point, reorder_quantity, created_at, updated_at)
                VALUES (gen_random_uuid(), $1, 'sydney', $2, $3, 10, 20, NOW(), NOW())
            """, product_id, sydney, res_syd)

            # Insert Melbourne location
            await conn.execute("""
                INSERT INTO product_stock_by_location
                (id, product_id, location, stock, reserved, reorder_point, reorder_quantity, created_at, updated_at)
                VALUES (gen_random_uuid(), $1, 'melbourne', $2, $3, 10, 20, NOW(), NOW())
            """, product_id, melbourne, res_melb)

            stock_count += 1

        print(f"   Created multi-location inventory for {stock_count} products")
        print(f"   Stock distributed across Brisbane, Sydney, and Melbourne")

        # Add a few products that need to be created for the demo
        print("\n8. Creating additional demo products...")

        # Industrial Ladder (out of stock - critical)
        ladder_id = await conn.fetchval("""
            INSERT INTO products (organization_id, sku, name, description, category, price, cost, stock, warehouse_location, is_active)
            VALUES ($1, 'SKU-201', 'Industrial Ladder 3m', 'Heavy-duty aluminum ladder', 'SAFETY_EQUIPMENT', 299.99, 180.00, 0, 'Warehouse D-1', true)
            RETURNING id
        """, org_id)

        # Add multi-location stock (all zero)
        for location in ['brisbane', 'sydney', 'melbourne']:
            await conn.execute("""
                INSERT INTO product_stock_by_location
                (id, product_id, location, stock, reserved, reorder_point, reorder_quantity, created_at, updated_at)
                VALUES (gen_random_uuid(), $1, $2, 0, 0, 10, 20, NOW(), NOW())
            """, ladder_id, location)

        # Extension Cord (location imbalance)
        cord_id = await conn.fetchval("""
            INSERT INTO products (organization_id, sku, name, description, category, price, cost, stock, warehouse_location, is_active)
            VALUES ($1, 'SKU-105', 'Extension Cord 20m', 'Heavy duty extension cord', 'ELECTRICAL', 89.99, 45.00, 40, 'Warehouse E-2', true)
            RETURNING id
        """, org_id)

        # Add multi-location stock (Brisbane zero, others have stock)
        await conn.execute("""
            INSERT INTO product_stock_by_location
            (id, product_id, location, stock, reserved, reorder_point, reorder_quantity, created_at, updated_at)
            VALUES (gen_random_uuid(), $1, 'brisbane', 0, 0, 10, 20, NOW(), NOW()),
                   (gen_random_uuid(), $1, 'sydney', 18, 5, 10, 20, NOW(), NOW()),
                   (gen_random_uuid(), $1, 'melbourne', 22, 0, 10, 20, NOW(), NOW())
        """, cord_id)

        print(f"   Created 2 additional products with multi-location stock")

        print("\n=== Database seeding completed successfully! ===")
        print("\nMulti-location inventory seeded:")
        print("   - Critical items: Products out of stock at all locations")
        print("   - Low stock items: Products with total stock < 20 units")
        print("   - Location imbalances: Products out at one location but available elsewhere")
        print("   - Transfer candidates: Products with significant stock imbalances")
        print("\nTest user credentials:")
        print("  Email: admin@ccw.com | Password: password123 | Role: Admin")
        print("  Email: manager@ccw.com | Password: password123 | Role: Manager")
        print("  Email: employee@ccw.com | Password: password123 | Role: Employee")

    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(seed_database())
