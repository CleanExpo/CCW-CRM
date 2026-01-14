-- Verify Container Tracking Sample Data
-- This script queries the created data to verify everything was inserted correctly

-- Check containers
SELECT
    'Containers' as table_name,
    COUNT(*) as record_count,
    COUNT(CASE WHEN status = 'in_transit' THEN 1 END) as in_transit_count,
    COUNT(CASE WHEN status = 'at_port' THEN 1 END) as at_port_count,
    COUNT(CASE WHEN estimated_arrival_date > NOW() THEN 1 END) as arriving_soon_count,
    COUNT(CASE WHEN estimated_arrival_date < NOW() AND status != 'delivered' THEN 1 END) as overdue_count
FROM containers;

-- Show container details
SELECT
    container_number,
    status,
    origin_port,
    destination_port,
    destination_warehouse,
    estimated_arrival_date,
    carrier,
    vessel_name
FROM containers
ORDER BY estimated_arrival_date;

-- Check container items
SELECT
    'Container Items' as table_name,
    COUNT(*) as record_count,
    SUM(quantity_ordered) as total_quantity_ordered,
    SUM(quantity_preallocated) as total_preallocated
FROM container_items;

-- Check backorders
SELECT
    'Backorders' as table_name,
    COUNT(*) as record_count,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
    COUNT(CASE WHEN status = 'allocated' THEN 1 END) as allocated_count,
    SUM(quantity_backordered) as total_backordered
FROM backorders;
