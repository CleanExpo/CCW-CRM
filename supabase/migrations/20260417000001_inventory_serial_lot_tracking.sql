-- =============================================================================
-- Migration: Inventory Serial Number & Lot/Batch Tracking (UNI-1823 Phase 1)
-- Description: New tables inventory_serials and inventory_lots for WHS
--              traceability, recall capability, and warranty lookups.
-- Phase 1: schema + migration only. Phase 2 = UI and service history.
-- Applied: 2026-04-17
-- =============================================================================

-- ---------------------------------------------------------------------------
-- inventory_lots: groups of identical items received together from a supplier
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_lots (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id         UUID        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  lot_number         TEXT        NOT NULL,
  batch_number       TEXT,
  quantity_received  INTEGER     NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
  quantity_remaining INTEGER     NOT NULL DEFAULT 0 CHECK (quantity_remaining >= 0),
  received_at        TIMESTAMPTZ,
  expiry_date        TIMESTAMPTZ,
  supplier_id        UUID        REFERENCES public.suppliers(id) ON DELETE SET NULL,
  purchase_order_id  UUID        REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_inventory_lot_product_lot UNIQUE (product_id, lot_number)
);

ALTER TABLE public.inventory_lots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_lots_service_role"
  ON public.inventory_lots FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_inventory_lots_product_id
  ON public.inventory_lots (product_id);

CREATE INDEX IF NOT EXISTS idx_inventory_lots_lot_number
  ON public.inventory_lots (lot_number);

CREATE INDEX IF NOT EXISTS idx_inventory_lots_supplier_id
  ON public.inventory_lots (supplier_id);

-- ---------------------------------------------------------------------------
-- inventory_serials: individual serialised units (unit-level traceability)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_serials (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  serial_number TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'in_stock'
                              CHECK (status IN ('in_stock','sold','returned','scrapped','lost')),
  location      TEXT,
  lot_id        UUID        REFERENCES public.inventory_lots(id) ON DELETE SET NULL,
  received_at   TIMESTAMPTZ,
  sold_at       TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_inventory_serial_number UNIQUE (serial_number)
);

ALTER TABLE public.inventory_serials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_serials_service_role"
  ON public.inventory_serials FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_inventory_serials_product_id
  ON public.inventory_serials (product_id);

CREATE INDEX IF NOT EXISTS idx_inventory_serials_serial_number
  ON public.inventory_serials (serial_number);

CREATE INDEX IF NOT EXISTS idx_inventory_serials_status
  ON public.inventory_serials (status);

CREATE INDEX IF NOT EXISTS idx_inventory_serials_lot_id
  ON public.inventory_serials (lot_id);
