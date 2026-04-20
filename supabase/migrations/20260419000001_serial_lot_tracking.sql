-- =============================================================================
-- Migration: Serial number and lot/batch tracking — Phase 1
-- Ticket: UNI-1823
-- Description: New tables inventory_serials (unit-level traceability) and
--              inventory_lots (bulk lot/batch traceability). Phase 1 covers
--              schema + migration only; UI and reports follow in Phase 2.
-- Applied: 2026-04-19
-- =============================================================================

-- ---------------------------------------------------------------------------
-- inventory_serials: one row per individual serialised unit
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.inventory_serials (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  serial_number   TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'available'
                    CHECK (status IN ('available', 'reserved', 'sold', 'servicing', 'retired')),
  location        TEXT,
  grn_line_id     UUID REFERENCES public.grn_line(id) ON DELETE SET NULL,
  order_item_id   UUID REFERENCES public.order_items(id) ON DELETE SET NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_inventory_serial_number UNIQUE (serial_number)
);

ALTER TABLE public.inventory_serials ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_serials_service_role ON public.inventory_serials
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_inv_serials_product_id ON public.inventory_serials(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_serials_status      ON public.inventory_serials(status);
CREATE INDEX IF NOT EXISTS idx_inv_serials_location    ON public.inventory_serials(location);

-- ---------------------------------------------------------------------------
-- inventory_lots: one row per received lot/batch
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.inventory_lots (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id         UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  lot_number         TEXT NOT NULL,
  batch_number       TEXT,                                         -- vendor batch alias
  quantity_received  INTEGER NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
  quantity_remaining INTEGER NOT NULL DEFAULT 0 CHECK (quantity_remaining >= 0),
  expiry_date        TIMESTAMPTZ,
  received_date      TIMESTAMPTZ,
  location           TEXT,
  grn_line_id        UUID REFERENCES public.grn_line(id) ON DELETE SET NULL,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_inventory_lot_product_lot UNIQUE (product_id, lot_number)
);

ALTER TABLE public.inventory_lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_lots_service_role ON public.inventory_lots
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_inv_lots_product_id ON public.inventory_lots(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_lots_location   ON public.inventory_lots(location);
CREATE INDEX IF NOT EXISTS idx_inv_lots_lot_number ON public.inventory_lots(lot_number);
CREATE INDEX IF NOT EXISTS idx_inv_lots_expiry     ON public.inventory_lots(expiry_date);
