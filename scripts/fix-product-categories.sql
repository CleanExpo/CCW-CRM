-- Fix Product Category Data Migration
-- Issue: ISS-001, ISS-002 - Enum mismatch causing quote module failures
-- Date: 2026-02-02

-- Update lowercase category values to uppercase to match PostgreSQL enum type
UPDATE products
SET category = 'HAND_TOOLS'::product_category
WHERE category = 'hand_tools';

-- Fix invalid categories (set to default ACCESSORIES)
UPDATE products
SET category = 'ACCESSORIES'::product_category
WHERE category NOT IN (
    'HEAVY_MACHINERY',
    'HAND_TOOLS',
    'POWER_TOOLS',
    'SAFETY_EQUIPMENT',
    'BUILDING_MATERIALS',
    'ELECTRICAL',
    'PLUMBING',
    'ACCESSORIES'
);

-- Verify all categories are valid
SELECT category, COUNT(*)
FROM products
GROUP BY category
ORDER BY category;
