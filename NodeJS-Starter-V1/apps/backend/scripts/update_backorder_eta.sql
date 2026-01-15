-- Update the pending backorder to have an ETA
UPDATE backorders
SET expected_availability_date = (CURRENT_TIMESTAMP + INTERVAL '10 days')
WHERE id = 'abc0e431-bbd3-4923-95bb-dd238a74c297';

-- Verify the update
SELECT id, product_id, expected_availability_date, status
FROM backorders
WHERE id = 'abc0e431-bbd3-4923-95bb-dd238a74c297';
