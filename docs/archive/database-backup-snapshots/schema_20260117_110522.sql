--
-- PostgreSQL database dump
--

\restrict EtII3srCwHjZEeiRrPKjgkohuZp7g627UA9Rk0OlKN8IMCbUErUYtIElIR2eVP3

-- Dumped from database version 15.15
-- Dumped by pg_dump version 15.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: australian_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.australian_state AS ENUM (
    'QLD',
    'NSW',
    'VIC',
    'SA',
    'WA',
    'TAS',
    'NT',
    'ACT'
);


--
-- Name: availability_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.availability_status AS ENUM (
    'AVAILABLE',
    'BOOKED',
    'TENTATIVE',
    'UNAVAILABLE'
);


--
-- Name: backorder_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.backorder_status AS ENUM (
    'pending',
    'allocated',
    'ready',
    'fulfilled',
    'cancelled'
);


--
-- Name: container_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.container_status AS ENUM (
    'booked',
    'in_transit',
    'at_port',
    'customs_clearance',
    'cleared',
    'out_for_delivery',
    'delivered',
    'cancelled'
);


--
-- Name: job_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.job_status AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed',
    'cancelled'
);


--
-- Name: order_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.order_status AS ENUM (
    'draft',
    'pending',
    'confirmed',
    'processing',
    'shipped',
    'delivered',
    'cancelled'
);


--
-- Name: product_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.product_category AS ENUM (
    'HEAVY_MACHINERY',
    'HAND_TOOLS',
    'POWER_TOOLS',
    'SAFETY_EQUIPMENT',
    'BUILDING_MATERIALS',
    'ELECTRICAL',
    'PLUMBING',
    'ACCESSORIES'
);


--
-- Name: quote_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.quote_status AS ENUM (
    'draft',
    'pending',
    'sent',
    'accepted',
    'rejected',
    'expired'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: agent_executions; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: agent_runs; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: ai_generated_content; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


--
-- Name: api_usage; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: api_usage_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.api_usage_summary AS
 SELECT api_usage.provider,
    api_usage.model,
    date(api_usage.created_at) AS usage_date,
    count(*) AS total_calls,
    sum(api_usage.input_tokens) AS total_input_tokens,
    sum(api_usage.output_tokens) AS total_output_tokens,
    sum(api_usage.total_cost) AS total_cost
   FROM public.api_usage
  GROUP BY api_usage.provider, api_usage.model, (date(api_usage.created_at))
  ORDER BY (date(api_usage.created_at)) DESC, (sum(api_usage.total_cost)) DESC;


--
-- Name: availability_slots; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: background_jobs; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: backorders; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: carrier_configurations; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: container_items; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: containers; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: contractors; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: conversation_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    role character varying(50) NOT NULL,
    content text NOT NULL,
    user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    id uuid NOT NULL,
    user_id uuid,
    title character varying(255) NOT NULL,
    content text NOT NULL,
    metadata jsonb NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: inbound_shipments; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: learning_insights; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: learning_patterns; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: order_activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_activity (
    id uuid NOT NULL,
    order_id uuid NOT NULL,
    event_type character varying(50) NOT NULL,
    message text NOT NULL,
    created_by character varying(255),
    meta_data json,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid,
    quantity integer NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    line_total numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    subdomain character varying(100),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: outbound_shipments; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: prds; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: product_stock_by_location; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: prompt_variants; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: purchase_order_items; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: quote_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_id uuid NOT NULL,
    product_id uuid,
    quantity integer NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    line_total numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: quotes; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: stock_adjustments; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: stock_reservations; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: stock_transfers; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: xero_connections; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: agent_executions agent_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_executions
    ADD CONSTRAINT agent_executions_pkey PRIMARY KEY (id);


--
-- Name: agent_runs agent_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_runs
    ADD CONSTRAINT agent_runs_pkey PRIMARY KEY (id);


--
-- Name: ai_generated_content ai_generated_content_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_generated_content
    ADD CONSTRAINT ai_generated_content_pkey PRIMARY KEY (id);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: api_usage api_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_usage
    ADD CONSTRAINT api_usage_pkey PRIMARY KEY (id);


--
-- Name: availability_slots availability_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_slots
    ADD CONSTRAINT availability_slots_pkey PRIMARY KEY (id);


--
-- Name: background_jobs background_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.background_jobs
    ADD CONSTRAINT background_jobs_pkey PRIMARY KEY (id);


--
-- Name: backorders backorders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backorders
    ADD CONSTRAINT backorders_pkey PRIMARY KEY (id);


--
-- Name: carrier_configurations carrier_configurations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_configurations
    ADD CONSTRAINT carrier_configurations_pkey PRIMARY KEY (id);


--
-- Name: container_items container_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.container_items
    ADD CONSTRAINT container_items_pkey PRIMARY KEY (id);


--
-- Name: containers containers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.containers
    ADD CONSTRAINT containers_pkey PRIMARY KEY (id);


--
-- Name: contractors contractors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contractors
    ADD CONSTRAINT contractors_pkey PRIMARY KEY (id);


--
-- Name: conversation_history conversation_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_history
    ADD CONSTRAINT conversation_history_pkey PRIMARY KEY (id);


--
-- Name: customers customers_customer_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_customer_number_key UNIQUE (customer_number);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: inbound_shipments inbound_shipments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_shipments
    ADD CONSTRAINT inbound_shipments_pkey PRIMARY KEY (id);


--
-- Name: learning_insights learning_insights_insight_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_insights
    ADD CONSTRAINT learning_insights_insight_id_key UNIQUE (insight_id);


--
-- Name: learning_insights learning_insights_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_insights
    ADD CONSTRAINT learning_insights_pkey PRIMARY KEY (id);


--
-- Name: learning_patterns learning_patterns_pattern_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_patterns
    ADD CONSTRAINT learning_patterns_pattern_id_key UNIQUE (pattern_id);


--
-- Name: learning_patterns learning_patterns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_patterns
    ADD CONSTRAINT learning_patterns_pkey PRIMARY KEY (id);


--
-- Name: order_activity order_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_activity
    ADD CONSTRAINT order_activity_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_subdomain_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_subdomain_key UNIQUE (subdomain);


--
-- Name: outbound_shipments outbound_shipments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbound_shipments
    ADD CONSTRAINT outbound_shipments_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: payments payments_xero_payment_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_xero_payment_id_key UNIQUE (xero_payment_id);


--
-- Name: prds prds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prds
    ADD CONSTRAINT prds_pkey PRIMARY KEY (id);


--
-- Name: product_stock_by_location product_stock_by_location_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_stock_by_location
    ADD CONSTRAINT product_stock_by_location_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_sku_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_sku_key UNIQUE (sku);


--
-- Name: prompt_variants prompt_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prompt_variants
    ADD CONSTRAINT prompt_variants_pkey PRIMARY KEY (id);


--
-- Name: prompt_variants prompt_variants_variant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prompt_variants
    ADD CONSTRAINT prompt_variants_variant_id_key UNIQUE (variant_id);


--
-- Name: purchase_order_items purchase_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: quote_items quote_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_items
    ADD CONSTRAINT quote_items_pkey PRIMARY KEY (id);


--
-- Name: quotes quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_pkey PRIMARY KEY (id);


--
-- Name: quotes quotes_quote_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_quote_number_key UNIQUE (quote_number);


--
-- Name: stock_adjustments stock_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_pkey PRIMARY KEY (id);


--
-- Name: stock_reservations stock_reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_reservations
    ADD CONSTRAINT stock_reservations_pkey PRIMARY KEY (id);


--
-- Name: stock_transfers stock_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: product_stock_by_location uq_product_location; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_stock_by_location
    ADD CONSTRAINT uq_product_location UNIQUE (product_id, location);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: xero_connections xero_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xero_connections
    ADD CONSTRAINT xero_connections_pkey PRIMARY KEY (id);


--
-- Name: idx_background_jobs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_background_jobs_created_at ON public.background_jobs USING btree (created_at);


--
-- Name: idx_background_jobs_job_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_background_jobs_job_type ON public.background_jobs USING btree (job_type);


--
-- Name: idx_background_jobs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_background_jobs_status ON public.background_jobs USING btree (status);


--
-- Name: idx_customers_company_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_company_name_trgm ON public.customers USING gin (company_name public.gin_trgm_ops);


--
-- Name: idx_customers_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_email ON public.customers USING btree (email);


--
-- Name: idx_order_items_order_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_order_product ON public.order_items USING btree (order_id, product_id);


--
-- Name: idx_orders_customer_status_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_customer_status_date ON public.orders USING btree (customer_id, status, order_date DESC);


--
-- Name: idx_orders_order_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_order_number ON public.orders USING btree (order_number);


--
-- Name: idx_products_description_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_description_trgm ON public.products USING gin (description public.gin_trgm_ops);


--
-- Name: idx_products_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_name_trgm ON public.products USING gin (name public.gin_trgm_ops);


--
-- Name: idx_products_org_category_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_org_category_active ON public.products USING btree (organization_id, category, is_active);


--
-- Name: idx_products_sku; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_sku ON public.products USING btree (sku);


--
-- Name: idx_quote_items_quote_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_items_quote_product ON public.quote_items USING btree (quote_id, product_id);


--
-- Name: idx_quotes_customer_status_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_customer_status_date ON public.quotes USING btree (customer_id, status, quote_date DESC);


--
-- Name: idx_quotes_quote_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_quote_number ON public.quotes USING btree (quote_number);


--
-- Name: ix_agent_executions_agent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_agent_executions_agent_id ON public.agent_executions USING btree (agent_id);


--
-- Name: ix_agent_executions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_agent_executions_user_id ON public.agent_executions USING btree (user_id);


--
-- Name: ix_agent_runs_agent_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_agent_runs_agent_name ON public.agent_runs USING btree (agent_name);


--
-- Name: ix_agent_runs_prd_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_agent_runs_prd_id ON public.agent_runs USING btree (prd_id);


--
-- Name: ix_agent_runs_started_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_agent_runs_started_at ON public.agent_runs USING btree (started_at);


--
-- Name: ix_agent_runs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_agent_runs_status ON public.agent_runs USING btree (status);


--
-- Name: ix_ai_generated_content_content_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ai_generated_content_content_type ON public.ai_generated_content USING btree (content_type);


--
-- Name: ix_ai_generated_content_entity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ai_generated_content_entity_id ON public.ai_generated_content USING btree (entity_id);


--
-- Name: ix_ai_generated_content_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ai_generated_content_user_id ON public.ai_generated_content USING btree (user_id);


--
-- Name: ix_api_usage_agent_run_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_api_usage_agent_run_id ON public.api_usage USING btree (agent_run_id);


--
-- Name: ix_api_usage_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_api_usage_created_at ON public.api_usage USING btree (created_at);


--
-- Name: ix_api_usage_prd_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_api_usage_prd_id ON public.api_usage USING btree (prd_id);


--
-- Name: ix_api_usage_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_api_usage_provider ON public.api_usage USING btree (provider);


--
-- Name: ix_availability_slots_contractor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_availability_slots_contractor_id ON public.availability_slots USING btree (contractor_id);


--
-- Name: ix_availability_slots_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_availability_slots_date ON public.availability_slots USING btree (date);


--
-- Name: ix_availability_slots_state; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_availability_slots_state ON public.availability_slots USING btree (state);


--
-- Name: ix_availability_slots_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_availability_slots_status ON public.availability_slots USING btree (status);


--
-- Name: ix_availability_slots_suburb; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_availability_slots_suburb ON public.availability_slots USING btree (suburb);


--
-- Name: ix_backorders_container_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_backorders_container_id ON public.backorders USING btree (container_id);


--
-- Name: ix_backorders_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_backorders_customer_id ON public.backorders USING btree (customer_id);


--
-- Name: ix_backorders_expected_availability_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_backorders_expected_availability_date ON public.backorders USING btree (expected_availability_date);


--
-- Name: ix_backorders_fulfillment_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_backorders_fulfillment_location ON public.backorders USING btree (fulfillment_location);


--
-- Name: ix_backorders_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_backorders_order_id ON public.backorders USING btree (order_id);


--
-- Name: ix_backorders_order_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_backorders_order_item_id ON public.backorders USING btree (order_item_id);


--
-- Name: ix_backorders_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_backorders_product_id ON public.backorders USING btree (product_id);


--
-- Name: ix_backorders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_backorders_status ON public.backorders USING btree (status);


--
-- Name: ix_carrier_configurations_carrier_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_carrier_configurations_carrier_name ON public.carrier_configurations USING btree (carrier_name);


--
-- Name: ix_container_items_container_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_container_items_container_id ON public.container_items USING btree (container_id);


--
-- Name: ix_container_items_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_container_items_product_id ON public.container_items USING btree (product_id);


--
-- Name: ix_containers_container_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_containers_container_number ON public.containers USING btree (container_number);


--
-- Name: ix_containers_destination_warehouse; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_containers_destination_warehouse ON public.containers USING btree (destination_warehouse);


--
-- Name: ix_containers_estimated_arrival_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_containers_estimated_arrival_date ON public.containers USING btree (estimated_arrival_date);


--
-- Name: ix_containers_purchase_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_containers_purchase_order_id ON public.containers USING btree (purchase_order_id);


--
-- Name: ix_containers_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_containers_status ON public.containers USING btree (status);


--
-- Name: ix_containers_supplier_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_containers_supplier_id ON public.containers USING btree (supplier_id);


--
-- Name: ix_contractors_abn; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_contractors_abn ON public.contractors USING btree (abn);


--
-- Name: ix_contractors_mobile; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_contractors_mobile ON public.contractors USING btree (mobile);


--
-- Name: ix_conversation_history_conversation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_conversation_history_conversation_id ON public.conversation_history USING btree (conversation_id);


--
-- Name: ix_conversation_history_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_conversation_history_user_id ON public.conversation_history USING btree (user_id);


--
-- Name: ix_customers_customer_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_customers_customer_number ON public.customers USING btree (customer_number);


--
-- Name: ix_customers_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_customers_organization_id ON public.customers USING btree (organization_id);


--
-- Name: ix_customers_xero_contact_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_customers_xero_contact_id ON public.customers USING btree (xero_contact_id);


--
-- Name: ix_inbound_shipments_destination_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_inbound_shipments_destination_location ON public.inbound_shipments USING btree (destination_location);


--
-- Name: ix_inbound_shipments_purchase_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_inbound_shipments_purchase_order_id ON public.inbound_shipments USING btree (purchase_order_id);


--
-- Name: ix_inbound_shipments_shipment_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_inbound_shipments_shipment_number ON public.inbound_shipments USING btree (shipment_number);


--
-- Name: ix_inbound_shipments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_inbound_shipments_status ON public.inbound_shipments USING btree (status);


--
-- Name: ix_inbound_shipments_supplier_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_inbound_shipments_supplier_id ON public.inbound_shipments USING btree (supplier_id);


--
-- Name: ix_inbound_shipments_tracking_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_inbound_shipments_tracking_number ON public.inbound_shipments USING btree (tracking_number);


--
-- Name: ix_learning_insights_agent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_learning_insights_agent_id ON public.learning_insights USING btree (agent_id);


--
-- Name: ix_learning_insights_insight_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_learning_insights_insight_id ON public.learning_insights USING btree (insight_id);


--
-- Name: ix_learning_insights_insight_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_learning_insights_insight_type ON public.learning_insights USING btree (insight_type);


--
-- Name: ix_learning_insights_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_learning_insights_priority ON public.learning_insights USING btree (priority);


--
-- Name: ix_learning_patterns_agent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_learning_patterns_agent_id ON public.learning_patterns USING btree (agent_id);


--
-- Name: ix_learning_patterns_pattern_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_learning_patterns_pattern_id ON public.learning_patterns USING btree (pattern_id);


--
-- Name: ix_learning_patterns_pattern_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_learning_patterns_pattern_type ON public.learning_patterns USING btree (pattern_type);


--
-- Name: ix_order_activity_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_order_activity_created_at ON public.order_activity USING btree (created_at);


--
-- Name: ix_order_activity_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_order_activity_event_type ON public.order_activity USING btree (event_type);


--
-- Name: ix_order_activity_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_order_activity_order_id ON public.order_activity USING btree (order_id);


--
-- Name: ix_orders_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_orders_customer_id ON public.orders USING btree (customer_id);


--
-- Name: ix_orders_fulfillment_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_orders_fulfillment_location ON public.orders USING btree (fulfillment_location);


--
-- Name: ix_orders_order_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_orders_order_date ON public.orders USING btree (order_date);


--
-- Name: ix_orders_order_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_orders_order_number ON public.orders USING btree (order_number);


--
-- Name: ix_orders_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_orders_organization_id ON public.orders USING btree (organization_id);


--
-- Name: ix_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_orders_status ON public.orders USING btree (status);


--
-- Name: ix_orders_tracking_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_orders_tracking_number ON public.orders USING btree (tracking_number);


--
-- Name: ix_orders_xero_invoice_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_orders_xero_invoice_id ON public.orders USING btree (xero_invoice_id);


--
-- Name: ix_orders_xero_sync_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_orders_xero_sync_status ON public.orders USING btree (xero_sync_status);


--
-- Name: ix_outbound_shipments_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_outbound_shipments_order_id ON public.outbound_shipments USING btree (order_id);


--
-- Name: ix_outbound_shipments_origin_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_outbound_shipments_origin_location ON public.outbound_shipments USING btree (origin_location);


--
-- Name: ix_outbound_shipments_shipment_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_outbound_shipments_shipment_number ON public.outbound_shipments USING btree (shipment_number);


--
-- Name: ix_outbound_shipments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_outbound_shipments_status ON public.outbound_shipments USING btree (status);


--
-- Name: ix_outbound_shipments_tracking_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_outbound_shipments_tracking_number ON public.outbound_shipments USING btree (tracking_number);


--
-- Name: ix_payments_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_payments_order_id ON public.payments USING btree (order_id);


--
-- Name: ix_payments_xero_payment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_payments_xero_payment_id ON public.payments USING btree (xero_payment_id);


--
-- Name: ix_prds_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_prds_created_at ON public.prds USING btree (created_at);


--
-- Name: ix_prds_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_prds_organization_id ON public.prds USING btree (organization_id);


--
-- Name: ix_prds_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_prds_status ON public.prds USING btree (status);


--
-- Name: ix_prds_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_prds_user_id ON public.prds USING btree (user_id);


--
-- Name: ix_product_stock_by_location_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_product_stock_by_location_location ON public.product_stock_by_location USING btree (location);


--
-- Name: ix_product_stock_by_location_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_product_stock_by_location_product_id ON public.product_stock_by_location USING btree (product_id);


--
-- Name: ix_products_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_products_organization_id ON public.products USING btree (organization_id);


--
-- Name: ix_products_sku; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_products_sku ON public.products USING btree (sku);


--
-- Name: ix_prompt_variants_agent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_prompt_variants_agent_id ON public.prompt_variants USING btree (agent_id);


--
-- Name: ix_prompt_variants_variant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_prompt_variants_variant_id ON public.prompt_variants USING btree (variant_id);


--
-- Name: ix_purchase_order_items_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_purchase_order_items_product_id ON public.purchase_order_items USING btree (product_id);


--
-- Name: ix_purchase_order_items_purchase_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_purchase_order_items_purchase_order_id ON public.purchase_order_items USING btree (purchase_order_id);


--
-- Name: ix_purchase_orders_delivery_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_purchase_orders_delivery_location ON public.purchase_orders USING btree (delivery_location);


--
-- Name: ix_purchase_orders_po_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_purchase_orders_po_number ON public.purchase_orders USING btree (po_number);


--
-- Name: ix_purchase_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_purchase_orders_status ON public.purchase_orders USING btree (status);


--
-- Name: ix_purchase_orders_supplier_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_purchase_orders_supplier_id ON public.purchase_orders USING btree (supplier_id);


--
-- Name: ix_quotes_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_quotes_customer_id ON public.quotes USING btree (customer_id);


--
-- Name: ix_quotes_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_quotes_organization_id ON public.quotes USING btree (organization_id);


--
-- Name: ix_quotes_quote_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_quotes_quote_number ON public.quotes USING btree (quote_number);


--
-- Name: ix_stock_adjustments_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_stock_adjustments_location ON public.stock_adjustments USING btree (location);


--
-- Name: ix_stock_adjustments_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_stock_adjustments_product_id ON public.stock_adjustments USING btree (product_id);


--
-- Name: ix_stock_reservations_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_stock_reservations_location ON public.stock_reservations USING btree (location);


--
-- Name: ix_stock_reservations_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_stock_reservations_order_id ON public.stock_reservations USING btree (order_id);


--
-- Name: ix_stock_reservations_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_stock_reservations_product_id ON public.stock_reservations USING btree (product_id);


--
-- Name: ix_stock_transfers_from_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_stock_transfers_from_location ON public.stock_transfers USING btree (from_location);


--
-- Name: ix_stock_transfers_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_stock_transfers_product_id ON public.stock_transfers USING btree (product_id);


--
-- Name: ix_stock_transfers_to_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_stock_transfers_to_location ON public.stock_transfers USING btree (to_location);


--
-- Name: ix_suppliers_company_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_suppliers_company_name ON public.suppliers USING btree (company_name);


--
-- Name: ix_suppliers_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_suppliers_email ON public.suppliers USING btree (email);


--
-- Name: ix_suppliers_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_suppliers_is_active ON public.suppliers USING btree (is_active);


--
-- Name: ix_suppliers_supplier_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_suppliers_supplier_code ON public.suppliers USING btree (supplier_code);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: ix_users_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_users_organization_id ON public.users USING btree (organization_id);


--
-- Name: ix_xero_connections_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_xero_connections_is_active ON public.xero_connections USING btree (is_active);


--
-- Name: ix_xero_connections_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_xero_connections_organization_id ON public.xero_connections USING btree (organization_id);


--
-- Name: ix_xero_connections_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_xero_connections_tenant_id ON public.xero_connections USING btree (tenant_id);


--
-- Name: agent_runs agent_runs_prd_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_runs
    ADD CONSTRAINT agent_runs_prd_id_fkey FOREIGN KEY (prd_id) REFERENCES public.prds(id) ON DELETE CASCADE;


--
-- Name: api_usage api_usage_prd_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_usage
    ADD CONSTRAINT api_usage_prd_id_fkey FOREIGN KEY (prd_id) REFERENCES public.prds(id) ON DELETE CASCADE;


--
-- Name: availability_slots availability_slots_contractor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_slots
    ADD CONSTRAINT availability_slots_contractor_id_fkey FOREIGN KEY (contractor_id) REFERENCES public.contractors(id) ON DELETE CASCADE;


--
-- Name: backorders backorders_container_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backorders
    ADD CONSTRAINT backorders_container_id_fkey FOREIGN KEY (container_id) REFERENCES public.containers(id);


--
-- Name: backorders backorders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backorders
    ADD CONSTRAINT backorders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: backorders backorders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backorders
    ADD CONSTRAINT backorders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: backorders backorders_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backorders
    ADD CONSTRAINT backorders_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: backorders backorders_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backorders
    ADD CONSTRAINT backorders_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: container_items container_items_container_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.container_items
    ADD CONSTRAINT container_items_container_id_fkey FOREIGN KEY (container_id) REFERENCES public.containers(id) ON DELETE CASCADE;


--
-- Name: container_items container_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.container_items
    ADD CONSTRAINT container_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: containers containers_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.containers
    ADD CONSTRAINT containers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: containers containers_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.containers
    ADD CONSTRAINT containers_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id);


--
-- Name: containers containers_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.containers
    ADD CONSTRAINT containers_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: contractors contractors_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contractors
    ADD CONSTRAINT contractors_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: customers customers_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: documents documents_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: inbound_shipments inbound_shipments_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_shipments
    ADD CONSTRAINT inbound_shipments_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id);


--
-- Name: inbound_shipments inbound_shipments_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_shipments
    ADD CONSTRAINT inbound_shipments_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: order_activity order_activity_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_activity
    ADD CONSTRAINT order_activity_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: orders orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: orders orders_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: outbound_shipments outbound_shipments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbound_shipments
    ADD CONSTRAINT outbound_shipments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: payments payments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: prds prds_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prds
    ADD CONSTRAINT prds_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: prds prds_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prds
    ADD CONSTRAINT prds_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: product_stock_by_location product_stock_by_location_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_stock_by_location
    ADD CONSTRAINT product_stock_by_location_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: products products_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: purchase_order_items purchase_order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: purchase_order_items purchase_order_items_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: purchase_orders purchase_orders_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id);


--
-- Name: purchase_orders purchase_orders_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: quote_items quote_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_items
    ADD CONSTRAINT quote_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: quote_items quote_items_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_items
    ADD CONSTRAINT quote_items_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE CASCADE;


--
-- Name: quotes quotes_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: quotes quotes_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: stock_adjustments stock_adjustments_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: stock_reservations stock_reservations_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_reservations
    ADD CONSTRAINT stock_reservations_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: stock_reservations stock_reservations_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_reservations
    ADD CONSTRAINT stock_reservations_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: stock_transfers stock_transfers_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: users users_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- PostgreSQL database dump complete
--

\unrestrict EtII3srCwHjZEeiRrPKjgkohuZp7g627UA9Rk0OlKN8IMCbUErUYtIElIR2eVP3

