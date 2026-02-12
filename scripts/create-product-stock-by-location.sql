-- Drop and recreate product_stock_by_location table with all required columns

DROP TABLE IF EXISTS product_stock_by_location CASCADE;

CREATE TABLE product_stock_by_location (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    location VARCHAR(50) NOT NULL,
    stock INTEGER DEFAULT 0 NOT NULL CHECK (stock >= 0),
    reserved INTEGER DEFAULT 0 NOT NULL CHECK (reserved >= 0),
    last_counted_at TIMESTAMPTZ,
    last_counted_by UUID,
    reorder_point INTEGER,
    reorder_quantity INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE (product_id, location)
);

CREATE INDEX idx_product_stock_location_product ON product_stock_by_location(product_id);
CREATE INDEX idx_product_stock_location_loc ON product_stock_by_location(location);

SELECT 'Product stock by location table created!' as status;
