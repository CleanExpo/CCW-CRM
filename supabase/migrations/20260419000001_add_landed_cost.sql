-- =============================================================================
-- Migration: Landed cost fields for GRN and inventory
-- Ticket: UNI-1832
-- Description: Adds freight_cost, customs_duty, handling_cost to grn header;
--              landed_cost_per_unit and cost_per_unit to grn_line;
--              average_cost to product_stock_by_location.
--              Enables accurate COGS by apportioning inbound logistics costs
--              across received SKUs proportionally by PO value.
-- Applied: 2026-04-19
-- =============================================================================

-- GRN header: landed cost components
ALTER TABLE public.grn
    ADD COLUMN IF NOT EXISTS freight_cost  NUMERIC(12, 4) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS customs_duty  NUMERIC(12, 4) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS handling_cost NUMERIC(12, 4) NOT NULL DEFAULT 0;

-- GRN line items: per-unit apportioned cost
ALTER TABLE public.grn_line
    ADD COLUMN IF NOT EXISTS landed_cost_per_unit NUMERIC(12, 4) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cost_per_unit         NUMERIC(12, 4) NOT NULL DEFAULT 0;

-- Product stock by location: weighted average landed cost
ALTER TABLE public.product_stock_by_location
    ADD COLUMN IF NOT EXISTS average_cost NUMERIC(12, 4);

COMMENT ON COLUMN public.grn.freight_cost   IS 'Inbound freight cost apportioned across this GRN';
COMMENT ON COLUMN public.grn.customs_duty   IS 'Customs/import duty apportioned across this GRN';
COMMENT ON COLUMN public.grn.handling_cost  IS 'Warehousing/handling cost apportioned across this GRN';
COMMENT ON COLUMN public.grn_line.landed_cost_per_unit IS 'Landed cost allocated to this SKU per unit (proportional by PO value)';
COMMENT ON COLUMN public.grn_line.cost_per_unit        IS 'Full landed cost per unit = po_unit_cost + landed_cost_per_unit';
COMMENT ON COLUMN public.product_stock_by_location.average_cost IS 'Weighted average landed cost per unit, updated on each GRN receipt';
