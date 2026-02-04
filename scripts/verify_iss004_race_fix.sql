-- ISS-004 Verification: Race Condition Fix
-- Tests PostgreSQL SEQUENCE atomicity

\echo '======================================================================'
\echo 'ISS-004 Verification: Race Condition Fix'
\echo '======================================================================'

\echo ''
\echo 'Test 1: Check for duplicate order numbers in database'
\echo '----------------------------------------------------------------------'
SELECT 'Order Duplicates' as test, COUNT(*) as duplicate_count
FROM (
    SELECT order_number, COUNT(*) as count
    FROM orders
    GROUP BY order_number
    HAVING COUNT(*) > 1
) duplicates;

\echo ''
\echo 'Test 2: Check for duplicate quote numbers in database'
\echo '----------------------------------------------------------------------'
SELECT 'Quote Duplicates' as test, COUNT(*) as duplicate_count
FROM (
    SELECT quote_number, COUNT(*) as count
    FROM quotes
    GROUP BY quote_number
    HAVING COUNT(*) > 1
) duplicates;

\echo ''
\echo 'Test 3: Verify sequences exist and are active'
\echo '----------------------------------------------------------------------'
SELECT
    schemaname,
    sequencename,
    last_value,
    is_called
FROM pg_sequences
WHERE sequencename IN ('order_number_seq', 'quote_number_seq')
ORDER BY sequencename;

\echo ''
\echo 'Test 4: Verify helper functions exist'
\echo '----------------------------------------------------------------------'
SELECT
    proname as function_name,
    pg_get_functiondef(oid) LIKE '%nextval%' as uses_sequence
FROM pg_proc
WHERE proname IN ('generate_order_number', 'generate_quote_number')
ORDER BY proname;

\echo ''
\echo 'Test 5: Generate 10 quote numbers concurrently (simulation)'
\echo '----------------------------------------------------------------------'
\echo 'Generating 10 quote numbers...'
SELECT generate_quote_number() as quote_number FROM generate_series(1, 10);

\echo ''
\echo 'Test 6: Check recent quote numbers for sequential IDs'
\echo '----------------------------------------------------------------------'
SELECT
    quote_number,
    CAST(SPLIT_PART(quote_number, '-', 3) AS INTEGER) as sequence_num
FROM quotes
ORDER BY created_at DESC
LIMIT 15;

\echo ''
\echo '======================================================================'
\echo 'Summary'
\echo '======================================================================'
\echo 'If all tests show:'
\echo '  - 0 duplicates in database'
\echo '  - Sequences exist and are active'
\echo '  - Functions use nextval()'
\echo '  - Generated numbers are unique and sequential'
\echo ''
\echo 'Then ISS-004 is VERIFIED - Race condition fix is working!'
\echo '======================================================================'
