-- Create function to generate quote numbers
CREATE OR REPLACE FUNCTION generate_quote_number() RETURNS TEXT AS $$
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
                SUBSTRING(quote_number FROM 'QT-' || year_part || '-(\d+)')
                AS INTEGER
            )
        ),
        0
    ) INTO max_num
    FROM quotes
    WHERE quote_number LIKE 'QT-' || year_part || '-%';

    -- Increment for next number
    next_num := max_num + 1;

    -- Return formatted quote number
    RETURN 'QT-' || year_part || '-' || LPAD(next_num::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- Test the function
SELECT generate_quote_number() as next_quote_number;
