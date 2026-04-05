CREATE TABLE public.agent_executions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id character varying(100) NOT NULL,
    agent_name character varying(255) NOT NULL,
    task text NOT NULL,
    status character varying(50) NOT NULL,
    result text,
    error text,
    execution_time_ms integer,
    user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone
);
CREATE TABLE public.agent_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_name character varying(255) NOT NULL,
    task_description text,
    status character varying(50) NOT NULL,
    progress integer,
    current_step character varying(255),
    outputs jsonb,
    error text,
    prd_id uuid,
    started_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at timestamp with time zone
);
CREATE TABLE public.ai_generated_content (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    content_type character varying(50) NOT NULL,
    title character varying(255),
    content text NOT NULL,
    metadata text,
    entity_type character varying(50),
    entity_id uuid,
    user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);
CREATE TABLE public.api_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_run_id character varying(255) NOT NULL,
    prd_id uuid,
    provider character varying(100) NOT NULL,
    model character varying(100) NOT NULL,
    input_tokens integer NOT NULL,
    output_tokens integer NOT NULL,
    cost_per_input_token numeric(20,10) NOT NULL,
    cost_per_output_token numeric(20,10) NOT NULL,
    total_cost numeric(20,10) GENERATED ALWAYS AS ((((input_tokens)::numeric * cost_per_input_token) + ((output_tokens)::numeric * cost_per_output_token))) STORED,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE public.availability_slots (
    id uuid NOT NULL,
    contractor_id uuid NOT NULL,
    date timestamp with time zone NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    suburb character varying(100) NOT NULL,
    state public.australian_state NOT NULL,
    postcode character varying(10),
    status public.availability_status,
    notes text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);
CREATE TABLE public.background_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_type character varying(100) NOT NULL,
    status public.job_status DEFAULT 'pending'::public.job_status NOT NULL,
    input_data json,
    output_data json,
    progress integer DEFAULT 0 NOT NULL,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone
);
CREATE TABLE public.backorders (
    id uuid NOT NULL,
    order_id uuid NOT NULL,
    order_item_id uuid,
    product_id uuid NOT NULL,
    customer_id uuid,
    quantity_backordered integer NOT NULL,
    quantity_fulfilled integer DEFAULT 0 NOT NULL,
    fulfillment_location character varying(50) DEFAULT 'brisbane'::character varying NOT NULL,
    container_id uuid,
    expected_availability_date timestamp with time zone,
    original_order_date timestamp with time zone NOT NULL,
    status character varying(9) DEFAULT 'pending'::character varying NOT NULL,
    customer_notified boolean DEFAULT false NOT NULL,
    last_notification_date timestamp with time zone,
    notification_count integer DEFAULT 0 NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    notes text,
    internal_notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    fulfilled_at timestamp with time zone
);
CREATE TABLE public.carrier_configurations (
    id uuid NOT NULL,
    carrier_name character varying(100) NOT NULL,
    api_key_encrypted text,
    api_endpoint character varying(255),
    is_active boolean NOT NULL,
    supported_services json,
    webhook_secret character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone
);
CREATE TABLE public.container_items (
    id uuid NOT NULL,
    container_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity_ordered integer NOT NULL,
    quantity_received integer DEFAULT 0 NOT NULL,
    quantity_damaged integer DEFAULT 0 NOT NULL,
    quantity_preallocated integer DEFAULT 0 NOT NULL,
    unit_cost numeric(10,2),
    quality_checked boolean DEFAULT false NOT NULL,
    quality_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.containers (
    id uuid NOT NULL,
    container_number character varying(50) NOT NULL,
    purchase_order_id uuid,
    supplier_id uuid,
    vessel_name character varying(255),
    voyage_number character varying(100),
    origin_port character varying(100),
    destination_port character varying(100),
    destination_warehouse character varying(50) DEFAULT 'brisbane'::character varying NOT NULL,
    booking_date timestamp with time zone,
    departure_date timestamp with time zone,
    estimated_arrival_date timestamp with time zone,
    actual_arrival_date timestamp with time zone,
    customs_clearance_date timestamp with time zone,
    delivered_date timestamp with time zone,
    status character varying(17) DEFAULT 'booked'::character varying NOT NULL,
    tracking_number character varying(100),
    carrier character varying(100),
    tracking_url character varying(500),
    tracking_events jsonb DEFAULT '{}'::jsonb NOT NULL,
    shipping_cost numeric(10,2),
    customs_duty numeric(10,2),
    other_charges numeric(10,2),
    notes text,
    internal_notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.contractors (
    id uuid NOT NULL,
    user_id uuid,
    name character varying(100) NOT NULL,
    mobile character varying(20) NOT NULL,
    abn character varying(20),
    email character varying(255),
    specialisation character varying(100),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);
CREATE TABLE public.conversation_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    role character varying(50) NOT NULL,
    content text NOT NULL,
    user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    customer_number character varying(50) NOT NULL,
    company_name character varying(255) NOT NULL,
    contact_name character varying(255),
    email character varying(255),
    phone character varying(50),
    address text,
    city character varying(100),
    state character varying(50),
    postcode character varying(20),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    xero_contact_id character varying(255),
    xero_synced_at timestamp with time zone
);
CREATE TABLE public.documents (
    id uuid NOT NULL,
    user_id uuid,
    title character varying(255) NOT NULL,
    content text NOT NULL,
    metadata jsonb NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);
CREATE TABLE public.inbound_shipments (
    id uuid NOT NULL,
    shipment_number character varying(50) NOT NULL,
    purchase_order_id uuid,
    supplier_id uuid NOT NULL,
    carrier_name character varying(100),
    carrier_service character varying(100),
    tracking_number character varying(100),
    origin_address text,
    destination_location character varying(50) NOT NULL,
    status character varying(50) NOT NULL,
    shipped_date timestamp with time zone,
    expected_delivery_date timestamp with time zone,
    actual_delivery_date timestamp with time zone,
    tracking_events json,
    last_tracking_update timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone
);
CREATE TABLE public.learning_insights (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    insight_id character varying(100) NOT NULL,
    insight_type character varying(30) NOT NULL,
    agent_id character varying(100) NOT NULL,
    priority character varying(10) NOT NULL,
    title character varying(500) NOT NULL,
    description text NOT NULL,
    recommended_action text NOT NULL,
    expected_improvement double precision NOT NULL,
    supporting_patterns json DEFAULT '[]'::json NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_implemented boolean DEFAULT false NOT NULL,
    implemented_at timestamp with time zone
);
CREATE TABLE public.learning_patterns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pattern_id character varying(100) NOT NULL,
    agent_id character varying(100) NOT NULL,
    pattern_type character varying(20) NOT NULL,
    task_category character varying(200) NOT NULL,
    observed_count integer DEFAULT 1 NOT NULL,
    success_rate double precision NOT NULL,
    avg_duration_ms double precision NOT NULL,
    confidence double precision NOT NULL,
    conditions json DEFAULT '{}'::json NOT NULL,
    actions json DEFAULT '[]'::json NOT NULL,
    outcomes json DEFAULT '{}'::json NOT NULL,
    pattern_metadata json DEFAULT '{}'::json NOT NULL,
    first_observed timestamp with time zone NOT NULL,
    last_observed timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.order_activity (
    id uuid NOT NULL,
    order_id uuid NOT NULL,
    event_type character varying(50) NOT NULL,
    message text NOT NULL,
    created_by character varying(255),
    meta_data json,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid,
    quantity integer NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    line_total numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    order_number character varying(50) NOT NULL,
    customer_id uuid,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    total numeric(10,2) NOT NULL,
    order_date timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    xero_invoice_id character varying(255),
    xero_synced_at timestamp with time zone,
    xero_sync_status character varying(50),
    fulfillment_location character varying(50),
    tracking_number character varying(100),
    carrier_name character varying(100),
    shipped_date timestamp with time zone,
    estimated_delivery_date timestamp with time zone,
    subtotal numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    tax numeric(10,2) DEFAULT '0'::numeric NOT NULL
);
CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    subdomain character varying(100),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.outbound_shipments (
    id uuid NOT NULL,
    shipment_number character varying(50) NOT NULL,
    order_id uuid NOT NULL,
    carrier_name character varying(100),
    carrier_service character varying(100),
    tracking_number character varying(100),
    origin_location character varying(50) NOT NULL,
    destination_address text,
    status character varying(50) NOT NULL,
    shipped_date timestamp with time zone,
    expected_delivery_date timestamp with time zone,
    actual_delivery_date timestamp with time zone,
    tracking_events json,
    last_tracking_update timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone
);
CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    xero_payment_id character varying(255) NOT NULL,
    amount double precision NOT NULL,
    payment_date timestamp with time zone NOT NULL,
    payment_method character varying(50) DEFAULT 'other'::character varying NOT NULL,
    reference character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.prds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    requirements text NOT NULL,
    context jsonb,
    executive_summary text,
    problem_statement text,
    prd_analysis jsonb,
    feature_decomposition jsonb,
    technical_spec jsonb,
    test_plan jsonb,
    roadmap jsonb,
    documents_generated character varying[],
    total_user_stories integer,
    total_api_endpoints integer,
    total_test_scenarios integer,
    total_sprints integer,
    estimated_duration_weeks integer,
    status character varying(50) NOT NULL,
    error_message text,
    model_used character varying(100),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at timestamp with time zone
);
CREATE TABLE public.product_stock_by_location (
    id uuid NOT NULL,
    product_id uuid NOT NULL,
    location character varying(50) NOT NULL,
    stock integer DEFAULT 0 NOT NULL,
    reserved integer DEFAULT 0 NOT NULL,
    last_counted_at timestamp with time zone,
    last_counted_by uuid,
    reorder_point integer,
    reorder_quantity integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_reserved_non_negative CHECK ((reserved >= 0)),
    CONSTRAINT ck_stock_non_negative CHECK ((stock >= 0))
);
CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    sku character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category character varying(50) NOT NULL,
    price numeric(10,2) NOT NULL,
    cost numeric(10,2),
    stock integer DEFAULT 0 NOT NULL,
    warehouse_location character varying(100),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.prompt_variants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    variant_id character varying(100) NOT NULL,
    agent_id character varying(100) NOT NULL,
    prompt_template text NOT NULL,
    version integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    executions integer DEFAULT 0 NOT NULL,
    success_count integer DEFAULT 0 NOT NULL,
    failure_count integer DEFAULT 0 NOT NULL,
    avg_duration_ms double precision DEFAULT '0'::double precision NOT NULL,
    confidence_score double precision DEFAULT '0.5'::double precision NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used timestamp with time zone
);
CREATE TABLE public.purchase_order_items (
    id uuid NOT NULL,
    purchase_order_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity integer NOT NULL,
    quantity_received integer NOT NULL,
    unit_cost numeric(10,2) NOT NULL,
    subtotal numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone
);
CREATE TABLE public.purchase_orders (
    id uuid NOT NULL,
    po_number character varying(50) NOT NULL,
    supplier_id uuid NOT NULL,
    delivery_location character varying(50) NOT NULL,
    status character varying(50) NOT NULL,
    order_date timestamp with time zone,
    expected_delivery_date timestamp with time zone,
    actual_delivery_date timestamp with time zone,
    subtotal numeric(10,2) NOT NULL,
    tax numeric(10,2) NOT NULL,
    shipping_cost numeric(10,2),
    total numeric(10,2) NOT NULL,
    notes text,
    xero_purchase_order_id character varying(255),
    xero_synced_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    created_by_id uuid
);
CREATE TABLE public.quote_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_id uuid NOT NULL,
    product_id uuid,
    quantity integer NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    line_total numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.quotes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    quote_number character varying(50) NOT NULL,
    customer_id uuid,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    total numeric(10,2) NOT NULL,
    quote_date timestamp with time zone DEFAULT now() NOT NULL,
    valid_until timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.stock_adjustments (
    id uuid NOT NULL,
    product_id uuid NOT NULL,
    location character varying(50) NOT NULL,
    quantity_change integer NOT NULL,
    previous_quantity integer NOT NULL,
    new_quantity integer NOT NULL,
    adjustment_type character varying(50) NOT NULL,
    reason character varying(500),
    reference_id uuid,
    adjusted_by uuid,
    adjusted_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.stock_reservations (
    id uuid NOT NULL,
    product_id uuid NOT NULL,
    order_id uuid NOT NULL,
    location character varying(50) NOT NULL,
    quantity integer NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying NOT NULL,
    expires_at timestamp with time zone,
    reserved_at timestamp with time zone DEFAULT now() NOT NULL,
    fulfilled_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.stock_transfers (
    id uuid NOT NULL,
    product_id uuid NOT NULL,
    from_location character varying(50) NOT NULL,
    to_location character varying(50) NOT NULL,
    quantity integer NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    reason character varying(500),
    notes character varying(1000),
    initiated_by uuid,
    completed_by uuid,
    initiated_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.suppliers (
    id uuid NOT NULL,
    supplier_code character varying(50) NOT NULL,
    company_name character varying(255) NOT NULL,
    contact_name character varying(255),
    email character varying(255),
    phone character varying(50),
    abn character varying(20),
    address text,
    city character varying(100),
    state character varying(50),
    postal_code character varying(20),
    country character varying(2) NOT NULL,
    payment_terms character varying(100),
    preferred_carrier character varying(100),
    xero_contact_id character varying(255),
    xero_synced_at timestamp with time zone,
    is_active boolean NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone
);
CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    email character varying(255) NOT NULL,
    hashed_password character varying(255) NOT NULL,
    full_name character varying(255),
    role character varying(50) DEFAULT 'employee'::character varying NOT NULL,
    is_admin boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.xero_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    tenant_id character varying(255) NOT NULL,
    tenant_name character varying(255),
    access_token text NOT NULL,
    refresh_token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    scopes json DEFAULT '[]'::json NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_synced_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
