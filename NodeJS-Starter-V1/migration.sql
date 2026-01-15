BEGIN;

CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL, 
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- Running upgrade  -> 68d51946645a

CREATE TABLE organizations (
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    name VARCHAR(255) NOT NULL, 
    subdomain VARCHAR(100), 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    UNIQUE (subdomain)
);

CREATE TABLE users (
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    organization_id UUID, 
    email VARCHAR(255) NOT NULL, 
    hashed_password VARCHAR(255) NOT NULL, 
    full_name VARCHAR(255), 
    role VARCHAR(50) DEFAULT 'employee' NOT NULL, 
    is_admin BOOLEAN DEFAULT false NOT NULL, 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    UNIQUE (email), 
    FOREIGN KEY(organization_id) REFERENCES organizations (id)
);

CREATE TABLE products (
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    organization_id UUID, 
    sku VARCHAR(50) NOT NULL, 
    name VARCHAR(255) NOT NULL, 
    description TEXT, 
    category VARCHAR(50) NOT NULL, 
    price NUMERIC(10, 2) NOT NULL, 
    cost NUMERIC(10, 2), 
    stock INTEGER DEFAULT 0 NOT NULL, 
    warehouse_location VARCHAR(100), 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    UNIQUE (sku), 
    FOREIGN KEY(organization_id) REFERENCES organizations (id)
);

CREATE TABLE customers (
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    organization_id UUID, 
    customer_number VARCHAR(50) NOT NULL, 
    company_name VARCHAR(255) NOT NULL, 
    contact_name VARCHAR(255), 
    email VARCHAR(255), 
    phone VARCHAR(50), 
    address TEXT, 
    city VARCHAR(100), 
    state VARCHAR(50), 
    postcode VARCHAR(20), 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    UNIQUE (customer_number), 
    FOREIGN KEY(organization_id) REFERENCES organizations (id)
);

CREATE TABLE orders (
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    organization_id UUID, 
    order_number VARCHAR(50) NOT NULL, 
    customer_id UUID, 
    status VARCHAR(20) DEFAULT 'draft' NOT NULL, 
    total NUMERIC(10, 2) NOT NULL, 
    order_date TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    notes TEXT, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    UNIQUE (order_number), 
    FOREIGN KEY(organization_id) REFERENCES organizations (id), 
    FOREIGN KEY(customer_id) REFERENCES customers (id)
);

CREATE TABLE order_items (
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    order_id UUID NOT NULL, 
    product_id UUID, 
    quantity INTEGER NOT NULL, 
    unit_price NUMERIC(10, 2) NOT NULL, 
    line_total NUMERIC(10, 2) NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(order_id) REFERENCES orders (id) ON DELETE CASCADE, 
    FOREIGN KEY(product_id) REFERENCES products (id)
);

CREATE TABLE quotes (
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    organization_id UUID, 
    quote_number VARCHAR(50) NOT NULL, 
    customer_id UUID, 
    status VARCHAR(20) DEFAULT 'draft' NOT NULL, 
    total NUMERIC(10, 2) NOT NULL, 
    quote_date TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    valid_until TIMESTAMP WITH TIME ZONE, 
    notes TEXT, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    UNIQUE (quote_number), 
    FOREIGN KEY(organization_id) REFERENCES organizations (id), 
    FOREIGN KEY(customer_id) REFERENCES customers (id)
);

CREATE TABLE quote_items (
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    quote_id UUID NOT NULL, 
    product_id UUID, 
    quantity INTEGER NOT NULL, 
    unit_price NUMERIC(10, 2) NOT NULL, 
    line_total NUMERIC(10, 2) NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(quote_id) REFERENCES quotes (id) ON DELETE CASCADE, 
    FOREIGN KEY(product_id) REFERENCES products (id)
);

CREATE INDEX ix_users_email ON users (email);

CREATE INDEX ix_users_organization_id ON users (organization_id);

CREATE INDEX ix_products_sku ON products (sku);

CREATE INDEX ix_products_organization_id ON products (organization_id);

CREATE INDEX ix_customers_organization_id ON customers (organization_id);

CREATE INDEX ix_customers_customer_number ON customers (customer_number);

CREATE INDEX ix_orders_organization_id ON orders (organization_id);

CREATE INDEX ix_orders_customer_id ON orders (customer_id);

CREATE INDEX ix_orders_order_number ON orders (order_number);

CREATE INDEX ix_quotes_organization_id ON quotes (organization_id);

CREATE INDEX ix_quotes_customer_id ON quotes (customer_id);

CREATE INDEX ix_quotes_quote_number ON quotes (quote_number);

INSERT INTO alembic_version (version_num) VALUES ('68d51946645a') RETURNING alembic_version.version_num;

-- Running upgrade 68d51946645a -> a3f92b1e4d8c

CREATE TABLE conversation_history (
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    conversation_id UUID NOT NULL, 
    role VARCHAR(50) NOT NULL, 
    content TEXT NOT NULL, 
    user_id UUID, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id)
);

CREATE TABLE agent_executions (
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    agent_id VARCHAR(100) NOT NULL, 
    agent_name VARCHAR(255) NOT NULL, 
    task TEXT NOT NULL, 
    status VARCHAR(50) NOT NULL, 
    result TEXT, 
    error TEXT, 
    execution_time_ms INTEGER, 
    user_id UUID, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    completed_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id)
);

CREATE TABLE ai_generated_content (
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    content_type VARCHAR(50) NOT NULL, 
    title VARCHAR(255), 
    content TEXT NOT NULL, 
    metadata TEXT, 
    entity_type VARCHAR(50), 
    entity_id UUID, 
    user_id UUID, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id)
);

CREATE INDEX ix_conversation_history_conversation_id ON conversation_history (conversation_id);

CREATE INDEX ix_conversation_history_user_id ON conversation_history (user_id);

CREATE INDEX ix_agent_executions_agent_id ON agent_executions (agent_id);

CREATE INDEX ix_agent_executions_user_id ON agent_executions (user_id);

CREATE INDEX ix_ai_generated_content_content_type ON ai_generated_content (content_type);

CREATE INDEX ix_ai_generated_content_entity_id ON ai_generated_content (entity_id);

CREATE INDEX ix_ai_generated_content_user_id ON ai_generated_content (user_id);

UPDATE alembic_version SET version_num='a3f92b1e4d8c' WHERE alembic_version.version_num = '68d51946645a';

-- Running upgrade a3f92b1e4d8c -> b8c4e2f9a1d3

CREATE TABLE learning_patterns (
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    pattern_id VARCHAR(100) NOT NULL, 
    agent_id VARCHAR(100) NOT NULL, 
    pattern_type VARCHAR(20) NOT NULL, 
    task_category VARCHAR(200) NOT NULL, 
    observed_count INTEGER DEFAULT '1' NOT NULL, 
    success_rate FLOAT NOT NULL, 
    avg_duration_ms FLOAT NOT NULL, 
    confidence FLOAT NOT NULL, 
    conditions JSON DEFAULT '{}' NOT NULL, 
    actions JSON DEFAULT '[]' NOT NULL, 
    outcomes JSON DEFAULT '{}' NOT NULL, 
    pattern_metadata JSON DEFAULT '{}' NOT NULL, 
    first_observed TIMESTAMP WITH TIME ZONE NOT NULL, 
    last_observed TIMESTAMP WITH TIME ZONE NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    UNIQUE (pattern_id)
);

CREATE TABLE learning_insights (
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    insight_id VARCHAR(100) NOT NULL, 
    insight_type VARCHAR(30) NOT NULL, 
    agent_id VARCHAR(100) NOT NULL, 
    priority VARCHAR(10) NOT NULL, 
    title VARCHAR(500) NOT NULL, 
    description TEXT NOT NULL, 
    recommended_action TEXT NOT NULL, 
    expected_improvement FLOAT NOT NULL, 
    supporting_patterns JSON DEFAULT '[]' NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    is_implemented BOOLEAN DEFAULT 'false' NOT NULL, 
    implemented_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id), 
    UNIQUE (insight_id)
);

CREATE TABLE prompt_variants (
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    variant_id VARCHAR(100) NOT NULL, 
    agent_id VARCHAR(100) NOT NULL, 
    prompt_template TEXT NOT NULL, 
    version INTEGER NOT NULL, 
    is_active BOOLEAN DEFAULT 'true' NOT NULL, 
    executions INTEGER DEFAULT '0' NOT NULL, 
    success_count INTEGER DEFAULT '0' NOT NULL, 
    failure_count INTEGER DEFAULT '0' NOT NULL, 
    avg_duration_ms FLOAT DEFAULT '0.0' NOT NULL, 
    confidence_score FLOAT DEFAULT '0.5' NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    last_used TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id), 
    UNIQUE (variant_id)
);

CREATE INDEX ix_learning_patterns_pattern_id ON learning_patterns (pattern_id);

CREATE INDEX ix_learning_patterns_agent_id ON learning_patterns (agent_id);

CREATE INDEX ix_learning_patterns_pattern_type ON learning_patterns (pattern_type);

CREATE INDEX ix_learning_insights_insight_id ON learning_insights (insight_id);

CREATE INDEX ix_learning_insights_agent_id ON learning_insights (agent_id);

CREATE INDEX ix_learning_insights_priority ON learning_insights (priority);

CREATE INDEX ix_learning_insights_insight_type ON learning_insights (insight_type);

CREATE INDEX ix_prompt_variants_variant_id ON prompt_variants (variant_id);

CREATE INDEX ix_prompt_variants_agent_id ON prompt_variants (agent_id);

UPDATE alembic_version SET version_num='b8c4e2f9a1d3' WHERE alembic_version.version_num = 'a3f92b1e4d8c';

-- Running upgrade b8c4e2f9a1d3 -> c5d3e4f9b2a4

CREATE TABLE xero_connections (
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    organization_id UUID, 
    tenant_id VARCHAR(255) NOT NULL, 
    tenant_name VARCHAR(255), 
    access_token TEXT NOT NULL, 
    refresh_token TEXT NOT NULL, 
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    scopes JSON DEFAULT '[]' NOT NULL, 
    is_active BOOLEAN DEFAULT 'true' NOT NULL, 
    last_synced_at TIMESTAMP WITH TIME ZONE, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id)
);

CREATE INDEX ix_xero_connections_tenant_id ON xero_connections (tenant_id);

CREATE INDEX ix_xero_connections_organization_id ON xero_connections (organization_id);

CREATE INDEX ix_xero_connections_is_active ON xero_connections (is_active);

CREATE TABLE payments (
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    order_id UUID NOT NULL, 
    xero_payment_id VARCHAR(255) NOT NULL, 
    amount FLOAT NOT NULL, 
    payment_date TIMESTAMP WITH TIME ZONE NOT NULL, 
    payment_method VARCHAR(50) DEFAULT 'other' NOT NULL, 
    reference VARCHAR(255), 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(order_id) REFERENCES orders (id) ON DELETE CASCADE, 
    UNIQUE (xero_payment_id)
);

CREATE INDEX ix_payments_order_id ON payments (order_id);

CREATE INDEX ix_payments_xero_payment_id ON payments (xero_payment_id);

ALTER TABLE orders ADD COLUMN xero_invoice_id VARCHAR(255);

ALTER TABLE orders ADD COLUMN xero_synced_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE orders ADD COLUMN xero_sync_status VARCHAR(50);

CREATE INDEX ix_orders_xero_invoice_id ON orders (xero_invoice_id);

CREATE INDEX ix_orders_xero_sync_status ON orders (xero_sync_status);

ALTER TABLE customers ADD COLUMN xero_contact_id VARCHAR(255);

ALTER TABLE customers ADD COLUMN xero_synced_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX ix_customers_xero_contact_id ON customers (xero_contact_id);

UPDATE alembic_version SET version_num='c5d3e4f9b2a4' WHERE alembic_version.version_num = 'b8c4e2f9a1d3';

-- Running upgrade c5d3e4f9b2a4 -> f25b3ce9e866

CREATE TABLE carrier_configurations (
    id UUID NOT NULL, 
    carrier_name VARCHAR(100) NOT NULL, 
    api_key_encrypted TEXT, 
    api_endpoint VARCHAR(255), 
    is_active BOOLEAN NOT NULL, 
    supported_services JSON, 
    webhook_secret VARCHAR(255), 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_carrier_configurations_carrier_name ON carrier_configurations (carrier_name);

CREATE TABLE suppliers (
    id UUID NOT NULL, 
    supplier_code VARCHAR(50) NOT NULL, 
    company_name VARCHAR(255) NOT NULL, 
    contact_name VARCHAR(255), 
    email VARCHAR(255), 
    phone VARCHAR(50), 
    abn VARCHAR(20), 
    address TEXT, 
    city VARCHAR(100), 
    state VARCHAR(50), 
    postal_code VARCHAR(20), 
    country VARCHAR(2) NOT NULL, 
    payment_terms VARCHAR(100), 
    preferred_carrier VARCHAR(100), 
    xero_contact_id VARCHAR(255), 
    xero_synced_at TIMESTAMP WITH TIME ZONE, 
    is_active BOOLEAN NOT NULL, 
    notes TEXT, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id)
);

CREATE INDEX ix_suppliers_company_name ON suppliers (company_name);

CREATE INDEX ix_suppliers_email ON suppliers (email);

CREATE INDEX ix_suppliers_is_active ON suppliers (is_active);

CREATE UNIQUE INDEX ix_suppliers_supplier_code ON suppliers (supplier_code);

CREATE TABLE purchase_orders (
    id UUID NOT NULL, 
    po_number VARCHAR(50) NOT NULL, 
    supplier_id UUID NOT NULL, 
    delivery_location VARCHAR(50) NOT NULL, 
    status VARCHAR(50) NOT NULL, 
    order_date TIMESTAMP WITH TIME ZONE, 
    expected_delivery_date TIMESTAMP WITH TIME ZONE, 
    actual_delivery_date TIMESTAMP WITH TIME ZONE, 
    subtotal NUMERIC(10, 2) NOT NULL, 
    tax NUMERIC(10, 2) NOT NULL, 
    shipping_cost NUMERIC(10, 2), 
    total NUMERIC(10, 2) NOT NULL, 
    notes TEXT, 
    xero_purchase_order_id VARCHAR(255), 
    xero_synced_at TIMESTAMP WITH TIME ZONE, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE, 
    created_by_id UUID, 
    PRIMARY KEY (id), 
    FOREIGN KEY(created_by_id) REFERENCES users (id), 
    FOREIGN KEY(supplier_id) REFERENCES suppliers (id)
);

CREATE INDEX ix_purchase_orders_delivery_location ON purchase_orders (delivery_location);

CREATE UNIQUE INDEX ix_purchase_orders_po_number ON purchase_orders (po_number);

CREATE INDEX ix_purchase_orders_status ON purchase_orders (status);

CREATE INDEX ix_purchase_orders_supplier_id ON purchase_orders (supplier_id);

CREATE TABLE inbound_shipments (
    id UUID NOT NULL, 
    shipment_number VARCHAR(50) NOT NULL, 
    purchase_order_id UUID, 
    supplier_id UUID NOT NULL, 
    carrier_name VARCHAR(100), 
    carrier_service VARCHAR(100), 
    tracking_number VARCHAR(100), 
    origin_address TEXT, 
    destination_location VARCHAR(50) NOT NULL, 
    status VARCHAR(50) NOT NULL, 
    shipped_date TIMESTAMP WITH TIME ZONE, 
    expected_delivery_date TIMESTAMP WITH TIME ZONE, 
    actual_delivery_date TIMESTAMP WITH TIME ZONE, 
    tracking_events JSON, 
    last_tracking_update TIMESTAMP WITH TIME ZONE, 
    notes TEXT, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(purchase_order_id) REFERENCES purchase_orders (id), 
    FOREIGN KEY(supplier_id) REFERENCES suppliers (id)
);

CREATE INDEX ix_inbound_shipments_destination_location ON inbound_shipments (destination_location);

CREATE INDEX ix_inbound_shipments_purchase_order_id ON inbound_shipments (purchase_order_id);

CREATE UNIQUE INDEX ix_inbound_shipments_shipment_number ON inbound_shipments (shipment_number);

CREATE INDEX ix_inbound_shipments_status ON inbound_shipments (status);

CREATE INDEX ix_inbound_shipments_supplier_id ON inbound_shipments (supplier_id);

CREATE INDEX ix_inbound_shipments_tracking_number ON inbound_shipments (tracking_number);

CREATE TABLE purchase_order_items (
    id UUID NOT NULL, 
    purchase_order_id UUID NOT NULL, 
    product_id UUID NOT NULL, 
    quantity INTEGER NOT NULL, 
    quantity_received INTEGER NOT NULL, 
    unit_cost NUMERIC(10, 2) NOT NULL, 
    subtotal NUMERIC(10, 2) NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(product_id) REFERENCES products (id), 
    FOREIGN KEY(purchase_order_id) REFERENCES purchase_orders (id) ON DELETE CASCADE
);

CREATE INDEX ix_purchase_order_items_product_id ON purchase_order_items (product_id);

CREATE INDEX ix_purchase_order_items_purchase_order_id ON purchase_order_items (purchase_order_id);

CREATE TABLE outbound_shipments (
    id UUID NOT NULL, 
    shipment_number VARCHAR(50) NOT NULL, 
    order_id UUID NOT NULL, 
    carrier_name VARCHAR(100), 
    carrier_service VARCHAR(100), 
    tracking_number VARCHAR(100), 
    origin_location VARCHAR(50) NOT NULL, 
    destination_address TEXT, 
    status VARCHAR(50) NOT NULL, 
    shipped_date TIMESTAMP WITH TIME ZONE, 
    expected_delivery_date TIMESTAMP WITH TIME ZONE, 
    actual_delivery_date TIMESTAMP WITH TIME ZONE, 
    tracking_events JSON, 
    last_tracking_update TIMESTAMP WITH TIME ZONE, 
    notes TEXT, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(order_id) REFERENCES orders (id)
);

CREATE INDEX ix_outbound_shipments_order_id ON outbound_shipments (order_id);

CREATE INDEX ix_outbound_shipments_origin_location ON outbound_shipments (origin_location);

CREATE UNIQUE INDEX ix_outbound_shipments_shipment_number ON outbound_shipments (shipment_number);

CREATE INDEX ix_outbound_shipments_status ON outbound_shipments (status);

CREATE INDEX ix_outbound_shipments_tracking_number ON outbound_shipments (tracking_number);

ALTER TABLE orders ADD COLUMN fulfillment_location VARCHAR(50);

ALTER TABLE orders ADD COLUMN tracking_number VARCHAR(100);

ALTER TABLE orders ADD COLUMN carrier_name VARCHAR(100);

ALTER TABLE orders ADD COLUMN shipped_date TIMESTAMP WITH TIME ZONE;

ALTER TABLE orders ADD COLUMN estimated_delivery_date TIMESTAMP WITH TIME ZONE;

CREATE INDEX ix_orders_fulfillment_location ON orders (fulfillment_location);

CREATE INDEX ix_orders_order_date ON orders (order_date);

CREATE INDEX ix_orders_status ON orders (status);

CREATE INDEX ix_orders_tracking_number ON orders (tracking_number);

UPDATE alembic_version SET version_num='f25b3ce9e866' WHERE alembic_version.version_num = 'c5d3e4f9b2a4';

-- Running upgrade f25b3ce9e866 -> d4f7a9b2e5c1

CREATE TYPE container_status AS ENUM ('booked', 'in_transit', 'at_port', 'customs_clearance', 'cleared', 'out_for_delivery', 'delivered', 'cancelled');

CREATE TYPE backorder_status AS ENUM ('pending', 'allocated', 'ready', 'fulfilled', 'cancelled');

CREATE TABLE containers (
    id UUID NOT NULL, 
    container_number VARCHAR(50) NOT NULL, 
    purchase_order_id UUID, 
    supplier_id UUID, 
    vessel_name VARCHAR(255), 
    voyage_number VARCHAR(100), 
    origin_port VARCHAR(100), 
    destination_port VARCHAR(100), 
    destination_warehouse VARCHAR(50) DEFAULT 'brisbane' NOT NULL, 
    booking_date TIMESTAMP WITH TIME ZONE, 
    departure_date TIMESTAMP WITH TIME ZONE, 
    estimated_arrival_date TIMESTAMP WITH TIME ZONE, 
    actual_arrival_date TIMESTAMP WITH TIME ZONE, 
    customs_clearance_date TIMESTAMP WITH TIME ZONE, 
    delivered_date TIMESTAMP WITH TIME ZONE, 
    status container_status DEFAULT 'booked' NOT NULL, 
    tracking_number VARCHAR(100), 
    carrier VARCHAR(100), 
    tracking_url VARCHAR(500), 
    tracking_events JSONB DEFAULT '{}' NOT NULL, 
    shipping_cost NUMERIC(10, 2), 
    customs_duty NUMERIC(10, 2), 
    other_charges NUMERIC(10, 2), 
    notes TEXT, 
    internal_notes TEXT, 
    created_by UUID, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(created_by) REFERENCES users (id), 
    FOREIGN KEY(purchase_order_id) REFERENCES purchase_orders (id), 
    FOREIGN KEY(supplier_id) REFERENCES suppliers (id)
);

CREATE UNIQUE INDEX ix_containers_container_number ON containers (container_number);

CREATE INDEX ix_containers_purchase_order_id ON containers (purchase_order_id);

CREATE INDEX ix_containers_supplier_id ON containers (supplier_id);

CREATE INDEX ix_containers_destination_warehouse ON containers (destination_warehouse);

CREATE INDEX ix_containers_estimated_arrival_date ON containers (estimated_arrival_date);

CREATE INDEX ix_containers_status ON containers (status);

CREATE TABLE container_items (
    id UUID NOT NULL, 
    container_id UUID NOT NULL, 
    product_id UUID NOT NULL, 
    quantity_ordered INTEGER NOT NULL, 
    quantity_received INTEGER DEFAULT '0' NOT NULL, 
    quantity_damaged INTEGER DEFAULT '0' NOT NULL, 
    quantity_preallocated INTEGER DEFAULT '0' NOT NULL, 
    unit_cost NUMERIC(10, 2), 
    quality_checked BOOLEAN DEFAULT 'false' NOT NULL, 
    quality_notes TEXT, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(container_id) REFERENCES containers (id) ON DELETE CASCADE, 
    FOREIGN KEY(product_id) REFERENCES products (id)
);

CREATE INDEX ix_container_items_container_id ON container_items (container_id);

CREATE INDEX ix_container_items_product_id ON container_items (product_id);

CREATE TABLE backorders (
    id UUID NOT NULL, 
    order_id UUID NOT NULL, 
    order_item_id UUID, 
    product_id UUID NOT NULL, 
    customer_id UUID, 
    quantity_backordered INTEGER NOT NULL, 
    quantity_fulfilled INTEGER DEFAULT '0' NOT NULL, 
    fulfillment_location VARCHAR(50) DEFAULT 'brisbane' NOT NULL, 
    container_id UUID, 
    expected_availability_date TIMESTAMP WITH TIME ZONE, 
    original_order_date TIMESTAMP WITH TIME ZONE NOT NULL, 
    status backorder_status DEFAULT 'pending' NOT NULL, 
    customer_notified BOOLEAN DEFAULT 'false' NOT NULL, 
    last_notification_date TIMESTAMP WITH TIME ZONE, 
    notification_count INTEGER DEFAULT '0' NOT NULL, 
    priority INTEGER DEFAULT '0' NOT NULL, 
    notes TEXT, 
    internal_notes TEXT, 
    created_by UUID, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    fulfilled_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(container_id) REFERENCES containers (id), 
    FOREIGN KEY(created_by) REFERENCES users (id), 
    FOREIGN KEY(customer_id) REFERENCES customers (id), 
    FOREIGN KEY(order_id) REFERENCES orders (id), 
    FOREIGN KEY(product_id) REFERENCES products (id)
);

CREATE INDEX ix_backorders_order_id ON backorders (order_id);

CREATE INDEX ix_backorders_order_item_id ON backorders (order_item_id);

CREATE INDEX ix_backorders_product_id ON backorders (product_id);

CREATE INDEX ix_backorders_customer_id ON backorders (customer_id);

CREATE INDEX ix_backorders_container_id ON backorders (container_id);

CREATE INDEX ix_backorders_fulfillment_location ON backorders (fulfillment_location);

CREATE INDEX ix_backorders_expected_availability_date ON backorders (expected_availability_date);

CREATE INDEX ix_backorders_status ON backorders (status);

UPDATE alembic_version SET version_num='d4f7a9b2e5c1' WHERE alembic_version.version_num = 'f25b3ce9e866';

COMMIT;

