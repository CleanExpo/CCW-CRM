-- Check backorder ETA values
SELECT
    id,
    product_id,
    quantity_backordered,
    expected_availability_date,
    status
FROM backorders
LIMIT 5;
