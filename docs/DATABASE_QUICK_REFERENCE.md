# Database Quick Reference - CCW-Online ERP

Quick reference for working with the database schema. For detailed documentation, see [DATABASE_SCHEMA_CHANGES.md](./DATABASE_SCHEMA_CHANGES.md).

---

## Current Schema Version

**Version**: `002_add_semantic_search`
**Database**: `ccw_erp_staging` (PostgreSQL 15 + pgvector v0.8.1)

---

## Quick Commands

```bash
# Run migrations
cd apps/backend && alembic upgrade head

# Check current version
alembic current

# Rollback one migration
alembic downgrade -1

# Connect to database
docker exec -it ccw-erp-postgres-staging psql -U ccw_staging -d ccw_erp_staging
```

---

## New Tables (Migration 001)

### `approvals`
Tracks multi-step approval workflows for quotes, orders, etc.

**Key Fields**: `approval_type`, `entity_id`, `entity_type`, `status`, `total_steps`, `current_step`

**Statuses**: `pending` → `in_progress` → `approved`/`rejected`

### `approval_steps`
Individual approval steps with assignees.

**Key Fields**: `approval_id`, `step_number`, `approver_id`, `status`, `comments`

**Relationship**: Cascade delete when approval is deleted

---

## Schema Changes (Migration 002)

### `products.embedding`
New column for AI-powered semantic search.

**Type**: `vector(1536)` (OpenAI ada-002 compatible)
**Index**: IVFFlat with cosine distance
**Nullable**: Yes (generated asynchronously)

---

## Common Queries

### Approval Workflows

```sql
-- Get pending approvals for a user
SELECT * FROM approvals
WHERE status = 'pending'
  AND requested_by = '{user_id}'
ORDER BY created_at DESC;

-- Get approval steps assigned to me
SELECT s.*, a.entity_type, a.entity_id
FROM approval_steps s
JOIN approvals a ON s.approval_id = a.id
WHERE s.approver_id = '{user_id}'
  AND s.status = 'pending'
ORDER BY s.deadline NULLS LAST;

-- Check approval progress
SELECT
    a.id,
    a.total_steps,
    COUNT(CASE WHEN s.status = 'approved' THEN 1 END) as completed,
    a.status
FROM approvals a
LEFT JOIN approval_steps s ON a.id = s.approval_id
WHERE a.id = '{approval_id}'
GROUP BY a.id;
```

### Semantic Search

```sql
-- Find products missing embeddings
SELECT id, sku, name
FROM products
WHERE embedding IS NULL
LIMIT 100;

-- Check embedding coverage
SELECT
    COUNT(*) as total,
    COUNT(embedding) as with_embeddings,
    ROUND(100.0 * COUNT(embedding) / COUNT(*), 2) as coverage_pct
FROM products;

-- Semantic search (from Python - see below)
```

---

## Python Usage

### Create Approval Workflow

```python
from src.db.approvals_models import Approval, ApprovalStep

# Create 2-step approval for a quote
approval = Approval(
    approval_type="quote_approval",
    entity_id=quote_id,
    entity_type="quote",
    total_steps=2,
    current_step=0,
    status="pending",
    requested_by=sales_user_id,
    notes="Large order - requires approval"
)
session.add(approval)

# Add approval steps
step1 = ApprovalStep(
    approval_id=approval.id,
    step_number=1,
    approver_id=manager_id,
    approver_role="sales_manager",
    status="pending"
)
step2 = ApprovalStep(
    approval_id=approval.id,
    step_number=2,
    approver_id=director_id,
    approver_role="sales_director",
    status="pending"
)
session.add_all([step1, step2])
await session.commit()
```

### Approve a Step

```python
from datetime import datetime, timezone

# Find pending step
step = await session.get(ApprovalStep, step_id)

# Approve it
step.status = "approved"
step.comments = "Approved - pricing looks good"
step.completed_at = datetime.now(timezone.utc)

# Update approval progress
approval = await session.get(Approval, step.approval_id)
approval.current_step += 1
approval.status = "in_progress"

if approval.current_step >= approval.total_steps:
    approval.status = "approved"
    approval.completed_at = datetime.now(timezone.utc)

await session.commit()
```

### Generate Product Embeddings

```python
import openai
from src.db.demo_models import Product

async def generate_embedding(product: Product):
    """Generate and store embedding for semantic search"""

    # Create text representation
    text = f"{product.name} {product.description} {product.category}"

    # Generate embedding
    response = openai.Embedding.create(
        model="text-embedding-ada-002",
        input=text
    )

    # Store in database
    product.embedding = response['data'][0]['embedding']
    await session.commit()
```

### Semantic Search

```python
from sqlalchemy import select

async def semantic_search(query: str, limit: int = 10):
    """Search products using natural language"""

    # Generate query embedding
    response = openai.Embedding.create(
        model="text-embedding-ada-002",
        input=query
    )
    query_embedding = response['data'][0]['embedding']

    # Search by cosine similarity
    stmt = (
        select(
            Product,
            Product.embedding.cosine_distance(query_embedding).label("score")
        )
        .where(Product.embedding.isnot(None))
        .order_by("score")
        .limit(limit)
    )

    result = await session.execute(stmt)
    return result.all()

# Example usage
results = await semantic_search("heavy duty power drill")
for product, score in results:
    print(f"{product.name} (similarity: {1 - score:.2f})")
```

### Find Similar Products

```python
async def get_recommendations(product_id: UUID, limit: int = 5):
    """Get product recommendations based on similarity"""

    product = await session.get(Product, product_id)

    stmt = (
        select(
            Product,
            Product.embedding.cosine_distance(product.embedding).label("score")
        )
        .where(Product.id != product_id)
        .where(Product.embedding.isnot(None))
        .order_by("score")
        .limit(limit)
    )

    result = await session.execute(stmt)
    return result.all()
```

---

## API Endpoints to Implement

### Approvals API

```python
# POST /api/approvals - Create approval request
# GET /api/approvals/{id} - Get approval details
# GET /api/approvals/my-pending - Get approvals I need to action
# POST /api/approvals/{id}/steps/{step_id}/approve - Approve a step
# POST /api/approvals/{id}/steps/{step_id}/reject - Reject a step
```

### Semantic Search API

```python
# GET /api/products/search?q=query - Semantic search
# GET /api/products/{id}/similar - Get similar products
# POST /api/products/{id}/generate-embedding - Generate embedding
# POST /api/products/bulk-generate-embeddings - Batch generate
```

---

## Performance Tips

### Semantic Search Optimization

```sql
-- Adjust search accuracy/speed trade-off
SET ivfflat.probes = 10;  -- Default: 1, Max: lists value

-- Higher probes = more accurate but slower
-- probes=1:  ~90% recall, fastest
-- probes=10: ~99% recall, balanced (recommended)
-- probes=100: ~100% recall, slower
```

### Index Maintenance

```sql
-- Rebuild index when product count doubles
DROP INDEX ix_products_embedding;
CREATE INDEX ix_products_embedding ON products
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 200);  -- Adjust: rows/1000, capped at 1000
```

---

## Troubleshooting

### Approval Not Progressing

**Check**: Ensure `current_step` is incremented after each approval
```python
approval.current_step += 1
approval.status = "in_progress" if approval.current_step < approval.total_steps else "approved"
```

### Semantic Search Returns Nothing

**Check**: Products have embeddings
```sql
SELECT COUNT(*) FROM products WHERE embedding IS NOT NULL;
```

**Fix**: Generate embeddings
```python
products = await session.execute(select(Product).where(Product.embedding.is_(None)))
for product in products.scalars():
    await generate_embedding(product)
```

### Slow Search Queries

**Check**: Index is being used
```sql
EXPLAIN ANALYZE
SELECT * FROM products
ORDER BY embedding <=> '[...]'::vector
LIMIT 10;

-- Should show "Index Scan using ix_products_embedding"
```

**Fix**: Ensure probes setting is reasonable
```sql
SHOW ivfflat.probes;  -- Should be 1-10 for good performance
SET ivfflat.probes = 5;
```

---

## Migration Rollback

If something goes wrong:

```bash
# Rollback semantic search migration
cd apps/backend
alembic downgrade 001_add_approvals

# Rollback approvals migration
alembic downgrade base

# Re-apply all migrations
alembic upgrade head
```

---

## Testing

```bash
# Test migrations
cd apps/backend
pytest tests/db/test_migrations.py

# Test approvals
pytest tests/api/test_approvals.py

# Test semantic search
pytest tests/api/test_semantic_search.py
```

---

## Next Steps

1. **Implement Approval API** - Create FastAPI endpoints for approval workflow
2. **Implement Search API** - Create semantic search endpoints
3. **Background Job** - Set up async embedding generation for new products
4. **Frontend** - Add approval dashboard and semantic search UI
5. **Monitoring** - Track embedding coverage and search performance

---

**See Also**:
- [DATABASE_SCHEMA_CHANGES.md](./DATABASE_SCHEMA_CHANGES.md) - Detailed schema documentation
- [CLAUDE.md](./project-root/CLAUDE.md) - Project architecture guide
- [.claude/STARTUP.md](../.claude/STARTUP.md) - Development workflow

**Last Updated**: 2026-02-02
