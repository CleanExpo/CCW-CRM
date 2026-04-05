-- Create Container Tracking Database Tables
-- This script creates the database schema for container tracking and backorder management
-- Run this script directly against PostgreSQL to create the tables

-- Create container_status enum type
DO $$ BEGIN
    CREATE TYPE container_status AS ENUM (
        'booked',
        'in_transit',
        'at_port',
        'customs_clearance',
        'cleared',
        'out_for_delivery',
        'delivered',
        'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create backorder_status enum type
DO $$ BEGIN
    CREATE TYPE backorder_status AS ENUM (
        'pending',
        'allocated',
        'ready',
        'fulfilled',
        'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create containers table
CREATE TABLE IF NOT EXISTS containers (
    id UUID PRIMARY KEY,
    container_number VARCHAR(50) NOT NULL UNIQUE,
    purchase_order_id UUID,
    supplier_id UUID,
    vessel_name VARCHAR(255),
    voyage_number VARCHAR(100),
    origin_port VARCHAR(100),
    destination_port VARCHAR(100),
    destination_warehouse VARCHAR(50) NOT NULL DEFAULT 'brisbane',
    booking_date TIMESTAMPTZ,
    departure_date TIMESTAMPTZ,
    estimated_arrival_date TIMESTAMPTZ,
    actual_arrival_date TIMESTAMPTZ,
    customs_clearance_date TIMESTAMPTZ,
    delivered_date TIMESTAMPTZ,
    status container_status NOT NULL DEFAULT 'booked',
    tracking_number VARCHAR(100),
    carrier VARCHAR(100),
    tracking_url VARCHAR(500),
    tracking_events JSONB NOT NULL DEFAULT '{}',
    shipping_cost NUMERIC(10, 2),
    customs_duty NUMERIC(10, 2),
    other_charges NUMERIC(10, 2),
    notes TEXT,
    internal_notes TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

-- Create indexes for containers table
CREATE INDEX IF NOT EXISTS ix_containers_container_number ON containers(container_number);
CREATE INDEX IF NOT EXISTS ix_containers_purchase_order_id ON containers(purchase_order_id);
CREATE INDEX IF NOT EXISTS ix_containers_supplier_id ON containers(supplier_id);
CREATE INDEX IF NOT EXISTS ix_containers_destination_warehouse ON containers(destination_warehouse);
CREATE INDEX IF NOT EXISTS ix_containers_estimated_arrival_date ON containers(estimated_arrival_date);
CREATE INDEX IF NOT EXISTS ix_containers_status ON containers(status);

-- Create container_items table
CREATE TABLE IF NOT EXISTS container_items (
    id UUID PRIMARY KEY,
    container_id UUID NOT NULL,
    product_id UUID NOT NULL,
    quantity_ordered INTEGER NOT NULL,
    quantity_received INTEGER NOT NULL DEFAULT 0,
    quantity_damaged INTEGER NOT NULL DEFAULT 0,
    quantity_preallocated INTEGER NOT NULL DEFAULT 0,
    unit_cost NUMERIC(10, 2),
    quality_checked BOOLEAN NOT NULL DEFAULT false,
    quality_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (container_id) REFERENCES containers(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Create indexes for container_items table
CREATE INDEX IF NOT EXISTS ix_container_items_container_id ON container_items(container_id);
CREATE INDEX IF NOT EXISTS ix_container_items_product_id ON container_items(product_id);

-- Create backorders table
CREATE TABLE IF NOT EXISTS backorders (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL,
    order_item_id UUID,
    product_id UUID NOT NULL,
    customer_id UUID,
    quantity_backordered INTEGER NOT NULL,
    quantity_fulfilled INTEGER NOT NULL DEFAULT 0,
    fulfillment_location VARCHAR(50) NOT NULL DEFAULT 'brisbane',
    container_id UUID,
    expected_availability_date TIMESTAMPTZ,
    original_order_date TIMESTAMPTZ NOT NULL,
    status backorder_status NOT NULL DEFAULT 'pending',
    customer_notified BOOLEAN NOT NULL DEFAULT false,
    last_notification_date TIMESTAMPTZ,
    notification_count INTEGER NOT NULL DEFAULT 0,
    priority INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    internal_notes TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    fulfilled_at TIMESTAMPTZ,
    FOREIGN KEY (container_id) REFERENCES containers(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Create indexes for backorders table
CREATE INDEX IF NOT EXISTS ix_backorders_order_id ON backorders(order_id);
CREATE INDEX IF NOT EXISTS ix_backorders_order_item_id ON backorders(order_item_id);
CREATE INDEX IF NOT EXISTS ix_backorders_product_id ON backorders(product_id);
CREATE INDEX IF NOT EXISTS ix_backorders_customer_id ON backorders(customer_id);
CREATE INDEX IF NOT EXISTS ix_backorders_container_id ON backorders(container_id);
CREATE INDEX IF NOT EXISTS ix_backorders_fulfillment_location ON backorders(fulfillment_location);
CREATE INDEX IF NOT EXISTS ix_backorders_expected_availability_date ON backorders(expected_availability_date);
CREATE INDEX IF NOT EXISTS ix_backorders_status ON backorders(status);

-- Success message
SELECT 'Container tracking tables created successfully!' as message;
