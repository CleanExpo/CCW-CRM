-- Migration: Add PostgreSQL SEQUENCE for atomic number generation
-- Created: 2026-01-27
-- Purpose: Eliminate race conditions in order/quote number generation

-- Create sequences
CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS quote_number_seq START WITH 1 INCREMENT BY 1;

-- Initialize sequences based on existing max numbers
-- Note: Existing order/quote numbers use microsecond timestamps which are too large
-- for INTEGER. We start fresh with sequences, which is fine for new numbers.
DO $$
DECLARE
    max_order_num INTEGER := 0;
    max_quote_num INTEGER := 0;
BEGIN
    -- Try to extract numeric portion from existing order numbers
    -- Only process numbers that fit in INTEGER range (< 2147483647)
    -- Format: ORD-YYYY-NNN (e.g., ORD-2026-000123)
    BEGIN
        SELECT COALESCE(MAX(CAST(SPLIT_PART(order_number, '-', 3) AS INTEGER)), 0)
        INTO max_order_num
        FROM orders
        WHERE order_number ~ 'ORD-[0-9]{4}-[0-9]+$'
        AND LENGTH(SPLIT_PART(order_number, '-', 3)) <= 9;  -- Fits in INTEGER
    EXCEPTION
        WHEN OTHERS THEN
            -- If any error occurs, start from 0
            max_order_num := 0;
    END;

    -- Try to extract numeric portion from existing quote numbers
    -- Format: Q-YYYY-NNN (e.g., Q-2026-000456)
    BEGIN
        SELECT COALESCE(MAX(CAST(SPLIT_PART(quote_number, '-', 3) AS INTEGER)), 0)
        INTO max_quote_num
        FROM quotes
        WHERE quote_number ~ 'Q-[0-9]{4}-[0-9]+$'
        AND LENGTH(SPLIT_PART(quote_number, '-', 3)) <= 9;  -- Fits in INTEGER
    EXCEPTION
        WHEN OTHERS THEN
            -- If any error occurs, start from 0
            max_quote_num := 0;
    END;

    -- Set sequence to max + 1 (or 1 if starting fresh)
    IF max_order_num > 0 THEN
        PERFORM setval('order_number_seq', max_order_num + 1, false);
    END IF;

    IF max_quote_num > 0 THEN
        PERFORM setval('quote_number_seq', max_quote_num + 1, false);
    END IF;
END $$;

-- Create helper functions for generating numbers
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
    current_year INTEGER;
    next_num INTEGER;
BEGIN
    current_year := EXTRACT(YEAR FROM CURRENT_DATE);
    next_num := nextval('order_number_seq');
    RETURN 'ORD-' || current_year::TEXT || '-' || LPAD(next_num::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS TEXT AS $$
DECLARE
    current_year INTEGER;
    next_num INTEGER;
BEGIN
    current_year := EXTRACT(YEAR FROM CURRENT_DATE);
    next_num := nextval('quote_number_seq');
    RETURN 'Q-' || current_year::TEXT || '-' || LPAD(next_num::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON SEQUENCE order_number_seq IS 'Atomic sequence for order number generation';
COMMENT ON SEQUENCE quote_number_seq IS 'Atomic sequence for quote number generation';
COMMENT ON FUNCTION generate_order_number() IS 'Generate next order number atomically using sequence';
COMMENT ON FUNCTION generate_quote_number() IS 'Generate next quote number atomically using sequence';
