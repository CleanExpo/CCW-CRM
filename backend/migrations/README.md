# Database Migrations

This directory contains SQL migration scripts for the CCW ERP database.

## Migration List

| # | Name | Date | Description | Status |
|---|------|------|-------------|--------|
| 001 | add_search_indexes | 2026-02-02 | Add trigram and B-tree indexes for search performance | Applied |

## Running Migrations

### Apply Migration

```bash
# From project root
docker exec -i nodejs-starter-postgres psql -U starter_user -d starter_db < apps/backend/migrations/001_add_search_indexes.sql
```

### Rollback Migration

```bash
# From project root
docker exec -i nodejs-starter-postgres psql -U starter_user -d starter_db < apps/backend/migrations/001_rollback.sql
```

### Verify Indexes

```bash
# List all indexes
docker exec nodejs-starter-postgres psql -U starter_user -d starter_db -c "\di"

# Check index usage
docker exec nodejs-starter-postgres psql -U starter_user -d starter_db -c "SELECT schemaname, tablename, indexname, idx_scan FROM pg_stat_user_indexes WHERE schemaname = 'public' ORDER BY idx_scan DESC LIMIT 20;"
```

## Migration 001: Search Performance Indexes

**Objective**: Improve search operation performance by 50-70%

**Indexes Created**:
- 6 trigram (GIN) indexes for fuzzy text search
- 11 B-tree indexes for foreign keys and filtering
- 2 composite indexes for common query patterns

**Expected Impact**:
- Customer search: 3,500ms → <1,000ms (71% improvement)
- Product search: 1,700ms → <800ms (53% improvement)

**Storage Impact**: ~50-100MB additional index storage

**Write Performance**: <5% slower on INSERTs (acceptable tradeoff)

## Best Practices

1. **Always test migrations** in development before production
2. **Run ANALYZE** after creating indexes to update query planner statistics
3. **Monitor index usage** regularly to identify unused indexes
4. **Check query plans** with EXPLAIN ANALYZE to verify indexes are being used
5. **Backup database** before running migrations

## Troubleshooting

**Issue**: Index creation is slow
- **Solution**: Index creation on large tables can take time. Monitor progress with `pg_stat_progress_create_index` view.

**Issue**: Query planner not using indexes
- **Solution**: Run `ANALYZE table_name;` to update statistics, or increase `random_page_cost` setting.

**Issue**: Indexes using too much disk space
- **Solution**: Trigram indexes are larger (~2-3x table size). Ensure adequate disk space before creation.

## Monitoring and Maintenance

### Check Index Usage

Run the monitoring script to see which indexes are being used:

```bash
cd apps/backend
python scripts/monitor_indexes.py
```

This will show:
- Index usage statistics (number of scans)
- Table statistics (row counts, sizes)
- Unused indexes (candidates for removal)
- Tables with high sequential scans (may need more indexes)

### Analyze Query Plans

Run the query plan analysis to verify indexes are being used:

```bash
cd apps/backend
./scripts/explain_queries.sh
```

This will show execution plans for common queries and help identify:
- Whether indexes are being used
- Query performance characteristics
- Potential optimization opportunities

### Performance Benchmarks

Benchmark search performance:

```bash
cd apps/backend
python scripts/benchmark_search.py
```

Compare results to baseline:
- BEFORE: `benchmarks/before_indexes.txt`
- AFTER: `benchmarks/after_indexes.txt`
- COMPARISON: `benchmarks/comparison.md`

### Regular Maintenance

**Weekly:**
- Check index usage with `monitor_indexes.py`
- Identify and remove unused indexes

**Monthly:**
- Run performance benchmarks
- Analyze query plans for frequently used queries
- VACUUM ANALYZE tables to update statistics

**When performance degrades:**
- Check for missing indexes on new query patterns
- Verify existing indexes are being used
- Consider composite indexes for common multi-column filters
