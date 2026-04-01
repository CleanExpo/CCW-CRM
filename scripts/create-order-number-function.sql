-- Create function to generate order numbers
CREATE OR REPLACE FUNCTION generate_order_number() RETURNS TEXT AS $$
DECLARE
    year_part TEXT;
    max_num INTEGER;
    next_num INTEGER;
BEGIN
    -- Get current year
    year_part := TO_CHAR(NOW(), 'YYYY');

    -- Get the maximum number for this year
    SELECT COALESCE(
        MAX(
            CAST(
                SUBSTRING(order_number FROM 'ORD-' || year_part || '-(\d+)')
                AS INTEGER
            )
        ),
        0
    ) INTO max_num
    FROM orders
    WHERE order_number LIKE 'ORD-' || year_part || '-%';

    -- Increment for next number
    next_num := max_num + 1;

    -- Return formatted order number
    RETURN 'ORD-' || year_part || '-' || LPAD(next_num::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- Test the function
SELECT generate_order_number() as next_order_number;
