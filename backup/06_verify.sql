-- Step 6: Verify schema import
SELECT 
    'Tables' as object_type,
    COUNT(*)::text as count
FROM pg_tables 
WHERE schemaname = 'public'
UNION ALL
SELECT 
    'Types',
    COUNT(*)::text
FROM pg_type 
WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') 
  AND typtype = 'e'
UNION ALL
SELECT 
    'Indexes',
    COUNT(*)::text
FROM pg_indexes
WHERE schemaname = 'public';

-- Show all tables
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
