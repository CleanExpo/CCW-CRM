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
