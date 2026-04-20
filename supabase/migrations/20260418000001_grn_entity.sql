-- =============================================================================
-- Migration: GRN (Goods Received Note) entity — Phase 1 of three-way match
-- Ticket: UNI-1833
-- Description: grn header + grn_line items. Required step between
--              PO-approved and PO-invoiced for AP verification.
-- Applied: 2026-04-18
-- =============================================================================

-- GRN header
CREATE TABLE IF NOT EXISTS public.grn (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_number       TEXT NOT NULL UNIQUE,
  po_id            UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE RESTRICT,
  supplier_id      UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  delivery_location TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'received', 'approved', 'rejected')),
  received_date    TIMESTAMPTZ,
  received_by      UUID,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ
);

ALTER TABLE public.grn ENABLE ROW LEVEL SECURITY;
CREATE POLICY grn_service_role ON public.grn FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_grn_po_id       ON public.grn(po_id);
CREATE INDEX IF NOT EXISTS idx_grn_supplier_id ON public.grn(supplier_id);
CREATE INDEX IF NOT EXISTS idx_grn_status      ON public.grn(status);
CREATE INDEX IF NOT EXISTS idx_grn_created_at  ON public.grn(created_at);

-- GRN line items
CREATE TABLE IF NOT EXISTS public.grn_line (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id            UUID NOT NULL REFERENCES public.grn(id) ON DELETE CASCADE,
  po_item_id        UUID NOT NULL REFERENCES public.purchase_order_items(id) ON DELETE RESTRICT,
  product_id        UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity_expected INTEGER NOT NULL CHECK (quantity_expected >= 0),
  quantity_received INTEGER NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
  quantity_rejected INTEGER NOT NULL DEFAULT 0 CHECK (quantity_rejected >= 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ
);

ALTER TABLE public.grn_line ENABLE ROW LEVEL SECURITY;
CREATE POLICY grn_line_service_role ON public.grn_line FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_grn_line_grn_id     ON public.grn_line(grn_id);
CREATE INDEX IF NOT EXISTS idx_grn_line_po_item_id ON public.grn_line(po_item_id);
CREATE INDEX IF NOT EXISTS idx_grn_line_product_id ON public.grn_line(product_id);
