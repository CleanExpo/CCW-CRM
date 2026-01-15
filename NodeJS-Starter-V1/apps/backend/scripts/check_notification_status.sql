-- Check notification status
SELECT
    id,
    customer_notified,
    notification_count,
    last_notification_date
FROM backorders
WHERE id = 'abc0e431-bbd3-4923-95bb-dd238a74c297';
