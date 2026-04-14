-- Add missing columns to orders table for Xero integration and fulfillment

-- Xero integration columns
ALTER TABLE orders ADD COLUMN IF NOT EXISTS xero_invoice_id VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS xero_synced_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS xero_sync_status VARCHAR(50);

-- Fulfillment and tracking columns
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_location VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS carrier_name VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipped_date TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_delivery_date TIMESTAMPTZ;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_location ON orders(fulfillment_location);
CREATE INDEX IF NOT EXISTS idx_orders_tracking_number ON orders(tracking_number);

SELECT 'Orders table updated with integration columns!' as status;
