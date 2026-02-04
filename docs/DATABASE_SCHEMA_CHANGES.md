# Database Schema Changes - CCW-Online ERP

This document tracks all database schema changes, migrations, and their implementation details.

---

## Overview

The CCW-Online ERP database uses **PostgreSQL 15** with **Alembic** for schema migrations. All migrations are located in `apps/backend/alembic/versions/`.

**Current Schema Version**: `002_add_semantic_search`

**Database Connection**:
- **Development**: `ccw_erp_staging` on `ccw-erp-postgres-staging` container
- **User**: `ccw_staging`
- **Extensions**: pgvector v0.8.1

---

## Migration History

| Version | Name | Date | Description | Status |
|---------|------|------|-------------|--------|
| 001 | `add_approvals` | 2026-02-02 | Multi-step approval workflow system | ✅ Deployed |
| 002 | `add_semantic_search` | 2026-02-02 | Vector embeddings for AI-powered search | ✅ Deployed |

---

## Migration 001: Approval Workflow System

**Revision ID**: `001_add_approvals`
**Created**: 2026-02-02
**Purpose**: Implement multi-step approval workflow for quotes, orders, and other entities

### Tables Created

#### 1. `approvals`

**Purpose**: Tracks approval requests for business entities (quotes, orders, etc.)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique approval identifier |
| `approval_type` | VARCHAR(50) | NOT NULL | Type of approval (e.g., 'quote_approval', 'order_approval') |
| `entity_id` | UUID | NOT NULL | ID of the entity being approved (quote, order, etc.) |
| `entity_type` | VARCHAR(50) | NOT NULL | Type of entity ('quote', 'order', etc.) |
| `status` | VARCHAR(20) | NOT NULL | Current status: 'pending', 'in_progress', 'approved', 'rejected' |
| `total_steps` | INTEGER | NOT NULL | Total number of approval steps required |
| `current_step` | INTEGER | NOT NULL | Current step number (1-indexed) |
| `requested_by` | UUID | NOT NULL | User ID who requested approval |
| `notes` | TEXT | NULL | Additional notes or comments |
| `created_at` | TIMESTAMPTZ | NOT NULL | When approval was requested |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Last update timestamp |
| `completed_at` | TIMESTAMPTZ | NULL | When approval was completed/rejected |

**Indexes**:
```sql
CREATE INDEX ix_approvals_status ON approvals(status);
CREATE INDEX ix_approvals_entity_id ON approvals(entity_id);
CREATE INDEX ix_approvals_approval_type ON approvals(approval_type);
CREATE INDEX ix_approvals_requested_by ON approvals(requested_by);
CREATE INDEX ix_approvals_created_at ON approvals(created_at);
```

**Common Queries**:
```sql
-- Get pending approvals for a user
SELECT * FROM approvals
WHERE status = 'pending'
  AND requested_by = '{user_id}'
ORDER BY created_at DESC;

-- Get all approvals for a specific entity
SELECT * FROM approvals
WHERE entity_id = '{entity_id}'
  AND entity_type = 'quote'
ORDER BY created_at DESC;
```

---

#### 2. `approval_steps`

**Purpose**: Individual steps within an approval workflow

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique step identifier |
| `approval_id` | UUID | FK → approvals(id) ON DELETE CASCADE | Parent approval |
| `step_number` | INTEGER | NOT NULL | Step sequence (1, 2, 3, ...) |
| `approver_id` | UUID | NOT NULL | User assigned to approve this step |
| `approver_role` | VARCHAR(50) | NULL | Role of approver (optional) |
| `status` | VARCHAR(20) | NOT NULL | 'pending', 'approved', 'rejected' |
| `comments` | TEXT | NULL | Approver comments |
| `created_at` | TIMESTAMPTZ | NOT NULL | When step was created |
| `completed_at` | TIMESTAMPTZ | NULL | When step was completed |
| `deadline` | TIMESTAMPTZ | NULL | Optional approval deadline |

**Indexes**:
```sql
CREATE INDEX ix_approval_steps_approval_id ON approval_steps(approval_id);
CREATE INDEX ix_approval_steps_approver_id ON approval_steps(approver_id);
CREATE INDEX ix_approval_steps_status ON approval_steps(status);
CREATE INDEX ix_approval_steps_step_number ON approval_steps(step_number);
```

**Relationships**:
- `approval_id` → `approvals.id` (CASCADE DELETE - deleting an approval deletes all its steps)

**Common Queries**:
```sql
-- Get all pending steps for a specific approver
SELECT s.*, a.entity_type, a.entity_id
FROM approval_steps s
JOIN approvals a ON s.approval_id = a.id
WHERE s.approver_id = '{user_id}'
  AND s.status = 'pending'
ORDER BY s.deadline NULLS LAST, s.created_at;

-- Get approval progress
SELECT
    a.id,
    a.total_steps,
    COUNT(CASE WHEN s.status = 'approved' THEN 1 END) as completed_steps,
    a.status
FROM approvals a
LEFT JOIN approval_steps s ON a.id = s.approval_id
WHERE a.id = '{approval_id}'
GROUP BY a.id;
```

---

### Approval Workflow Logic

**States and Transitions**:

```
pending → in_progress → approved/rejected
   ↓           ↓
(waiting)   (step N of M)
```

**Rules**:
1. Approval starts with `status = 'pending'`, `current_step = 0`
2. When first step is approved, status → `in_progress`, `current_step = 1`
3. Each subsequent approval increments `current_step`
4. When `current_step = total_steps`, status → `approved`
5. Any step rejection → status = `rejected`, workflow stops
6. Cascade delete: Deleting an approval deletes all its steps

**Example Workflow**:
```python
# Create a 3-step approval for a quote
approval = Approval(
    approval_type='quote_approval',
    entity_id=quote_id,
    entity_type='quote',
    total_steps=3,
    current_step=0,
    status='pending',
    requested_by=sales_user_id
)

# Create steps
steps = [
    ApprovalStep(approval_id=approval.id, step_number=1, approver_id=manager_id),
    ApprovalStep(approval_id=approval.id, step_number=2, approver_id=director_id),
    ApprovalStep(approval_id=approval.id, step_number=3, approver_id=cfo_id),
]
```

---

### SQLAlchemy Models

**Location**: `apps/backend/src/db/approvals_models.py`

```python
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from .models_base import Base
import uuid
from datetime import datetime, timezone

class Approval(Base):
    __tablename__ = "approvals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    approval_type = Column(String(50), nullable=False, index=True)
    entity_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    entity_type = Column(String(50), nullable=False)
    status = Column(String(20), nullable=False, index=True)
    total_steps = Column(Integer, nullable=False)
    current_step = Column(Integer, nullable=False, default=0)
    requested_by = Column(UUID(as_uuid=True), nullable=False, index=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    steps = relationship("ApprovalStep", back_populates="approval", cascade="all, delete-orphan")

class ApprovalStep(Base):
    __tablename__ = "approval_steps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    approval_id = Column(UUID(as_uuid=True), ForeignKey("approvals.id", ondelete="CASCADE"), nullable=False, index=True)
    step_number = Column(Integer, nullable=False, index=True)
    approver_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    approver_role = Column(String(50), nullable=True)
    status = Column(String(20), nullable=False, default="pending", index=True)
    comments = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime(timezone=True), nullable=True)
    deadline = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    approval = relationship("Approval", back_populates="steps")
```

---

### Use Cases

#### 1. Quote Approval Workflow
```
Sales Rep → Manager → Director → CFO (for quotes > $50k)
```

#### 2. Order Modification Approval
```
Warehouse → Sales Manager (for order changes after confirmation)
```

#### 3. Custom Discount Approval
```
Sales Rep → Manager (for discounts > 15%)
Sales Rep → Manager → Director (for discounts > 25%)
```

---

## Migration 002: Semantic Search with pgvector

**Revision ID**: `002_add_semantic_search`
**Created**: 2026-02-02
**Purpose**: Enable AI-powered semantic search and product recommendations using vector embeddings

### Changes Made

#### 1. Enabled pgvector Extension

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

**Version**: v0.8.1
**Provides**:
- `vector` data type for storing embeddings
- `ivfflat` and `hnsw` index types for similarity search
- Distance operators: `<->` (L2), `<#>` (inner product), `<=>` (cosine)

---

#### 2. Added Embedding Column to Products

```sql
ALTER TABLE products
ADD COLUMN embedding vector(1536);

COMMENT ON COLUMN products.embedding IS
'Vector embedding for semantic search (1536 dimensions, OpenAI ada-002 compatible)';
```

**Details**:
- **Dimensions**: 1536 (compatible with OpenAI `text-embedding-ada-002`)
- **Storage**: ~6KB per product (1536 floats × 4 bytes)
- **Nullable**: Yes (embeddings generated asynchronously)

---

#### 3. Created Vector Similarity Index

```sql
CREATE INDEX ix_products_embedding
ON products
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

**Index Type**: IVFFlat (Inverted File with Flat compression)
**Distance Metric**: Cosine similarity (`vector_cosine_ops`)
**Lists**: 100 (recommended: rows/1000, capped at 1000)

**Performance**:
- **Exact Search**: `O(n)` - scans all rows
- **IVFFlat Search**: `O(n/lists)` - scans ~1% of rows (with lists=100)
- **Trade-off**: Slight recall loss (~99% accuracy) for 100x speed improvement

---

### Updated Schema

#### `products` Table (Partial)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Product identifier |
| `sku` | VARCHAR(100) | UNIQUE, NOT NULL | Stock keeping unit |
| `name` | VARCHAR(255) | NOT NULL | Product name |
| `description` | TEXT | NULL | Product description |
| `category` | VARCHAR(50) | NOT NULL | Product category |
| `embedding` | VECTOR(1536) | NULL | AI-generated embedding for semantic search |
| ... | ... | ... | ... |

**New Indexes**:
```sql
CREATE INDEX ix_products_embedding ON products USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

---

### SQLAlchemy Models

**Location**: `apps/backend/src/db/ai_search_models.py`

```python
from sqlalchemy import Column, Text, select, func
from sqlalchemy.dialects.postgresql import UUID
from pgvector.sqlalchemy import Vector
from .demo_models import Product  # Extends existing Product model

# Extend Product model with embedding column
# (This is conceptual - actual implementation may vary based on SQLAlchemy version)

class ProductWithEmbedding(Product):
    """
    Extended Product model with vector embedding for semantic search.
    Note: In practice, this extends the existing Product model in demo_models.py
    """
    embedding = Column(Vector(1536), nullable=True)

    @classmethod
    async def semantic_search(cls, session, query_embedding, limit=10):
        """
        Search products by vector similarity

        Args:
            session: AsyncSession
            query_embedding: List[float] of length 1536
            limit: Number of results to return

        Returns:
            List of (product, similarity_score) tuples
        """
        stmt = (
            select(
                cls,
                cls.embedding.cosine_distance(query_embedding).label("distance")
            )
            .where(cls.embedding.isnot(None))
            .order_by("distance")
            .limit(limit)
        )

        result = await session.execute(stmt)
        return result.all()
```

---

### Usage Examples

#### 1. Generate and Store Embeddings

```python
import openai
from sqlalchemy.ext.asyncio import AsyncSession

async def generate_product_embedding(product: Product, session: AsyncSession):
    """Generate and store embedding for a product"""

    # Create text representation
    text = f"{product.name} {product.description} {product.category}"

    # Generate embedding using OpenAI
    response = openai.Embedding.create(
        model="text-embedding-ada-002",
        input=text
    )

    embedding = response['data'][0]['embedding']

    # Store in database
    product.embedding = embedding
    await session.commit()
```

#### 2. Semantic Search Query

```python
async def search_products(query: str, session: AsyncSession, limit: int = 10):
    """Search products using natural language query"""

    # Generate query embedding
    response = openai.Embedding.create(
        model="text-embedding-ada-002",
        input=query
    )
    query_embedding = response['data'][0]['embedding']

    # Search using cosine similarity
    stmt = (
        select(
            Product,
            Product.embedding.cosine_distance(query_embedding).label("distance")
        )
        .where(Product.embedding.isnot(None))
        .order_by("distance")
        .limit(limit)
    )

    result = await session.execute(stmt)
    return result.all()
```

**Example Queries**:
```python
# Natural language search
results = await search_products("heavy duty power tools for construction", session)
# Returns: Jackhammers, industrial drills, concrete mixers, etc.

results = await search_products("safety equipment for high voltage work", session)
# Returns: Insulated gloves, safety harnesses, voltage detectors, etc.
```

#### 3. Product Recommendations

```python
async def get_similar_products(product_id: UUID, session: AsyncSession, limit: int = 5):
    """Find similar products based on embeddings"""

    # Get source product
    product = await session.get(Product, product_id)

    if not product or not product.embedding:
        return []

    # Find similar products
    stmt = (
        select(
            Product,
            Product.embedding.cosine_distance(product.embedding).label("distance")
        )
        .where(Product.id != product_id)
        .where(Product.embedding.isnot(None))
        .order_by("distance")
        .limit(limit)
    )

    result = await session.execute(stmt)
    return result.all()
```

---

### Performance Considerations

#### Index Tuning

**Lists Parameter**: Controls IVFFlat clustering
```python
# Recommended formula
lists = min(max(rows / 1000, 10), 1000)

# Examples:
# 1,000 products   → lists = 10
# 10,000 products  → lists = 100 (current setting)
# 100,000 products → lists = 1000
```

**Rebuild Index** when product count changes significantly:
```sql
DROP INDEX ix_products_embedding;
CREATE INDEX ix_products_embedding
ON products
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 200);  -- Adjust based on row count
```

#### Query Performance

**Without Index** (exact search):
```sql
-- Scans all rows - slow for large datasets
SELECT * FROM products
ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector
LIMIT 10;
-- Time: ~500ms for 10k products
```

**With Index** (approximate search):
```sql
-- Uses IVFFlat index - much faster
SET ivfflat.probes = 10;  -- Search 10 clusters (default: 1)

SELECT * FROM products
ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector
LIMIT 10;
-- Time: ~5ms for 10k products (100x faster)
```

**Probes Setting**: Controls accuracy/speed trade-off
- `probes = 1`: Fastest, lowest accuracy (~90%)
- `probes = 10`: Balanced (recommended, ~99% accuracy)
- `probes = lists`: Exact search (same as no index)

---

### Monitoring and Maintenance

#### Check Embedding Coverage

```sql
SELECT
    COUNT(*) as total_products,
    COUNT(embedding) as products_with_embeddings,
    ROUND(100.0 * COUNT(embedding) / COUNT(*), 2) as coverage_percent
FROM products;
```

#### Find Products Missing Embeddings

```sql
SELECT id, sku, name
FROM products
WHERE embedding IS NULL
ORDER BY created_at DESC
LIMIT 100;
```

#### Index Statistics

```sql
-- Check index size
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE indexname = 'ix_products_embedding';
```

---

### Future Enhancements

#### 1. Multi-Language Embeddings

Support semantic search in multiple languages by generating embeddings for translated content:

```sql
ALTER TABLE translations
ADD COLUMN embedding vector(1536);

CREATE INDEX ix_translations_embedding
ON translations
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

#### 2. HNSW Index (Better Performance)

Upgrade to HNSW (Hierarchical Navigable Small World) for better performance on large datasets:

```sql
-- Requires pgvector 0.5.0+
DROP INDEX ix_products_embedding;

CREATE INDEX ix_products_embedding
ON products
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Better recall (99.5%+) with similar speed to IVFFlat
```

#### 3. Hybrid Search

Combine semantic search with traditional filters:

```python
async def hybrid_search(
    query: str,
    category: str = None,
    min_price: float = None,
    max_price: float = None,
    limit: int = 10
):
    """Semantic search with traditional filters"""

    query_embedding = generate_embedding(query)

    stmt = (
        select(Product, Product.embedding.cosine_distance(query_embedding))
        .where(Product.embedding.isnot(None))
    )

    if category:
        stmt = stmt.where(Product.category == category)
    if min_price:
        stmt = stmt.where(Product.price >= min_price)
    if max_price:
        stmt = stmt.where(Product.price <= max_price)

    stmt = stmt.order_by("distance").limit(limit)

    return await session.execute(stmt)
```

---

## Migration Commands

### Apply Migrations

```bash
# Apply all pending migrations
cd apps/backend
alembic upgrade head

# Apply specific migration
alembic upgrade 001_add_approvals
alembic upgrade 002_add_semantic_search
```

### Rollback Migrations

```bash
# Rollback one migration
alembic downgrade -1

# Rollback to specific version
alembic downgrade 001_add_approvals

# Rollback all migrations
alembic downgrade base
```

### Check Migration Status

```bash
# Show current version
alembic current

# Show migration history
alembic history

# Show pending migrations
alembic heads
```

### Verify Schema

```bash
# Check tables exist
docker exec ccw-erp-postgres-staging psql -U ccw_staging -d ccw_erp_staging -c "\dt"

# Check specific table structure
docker exec ccw-erp-postgres-staging psql -U ccw_staging -d ccw_erp_staging -c "\d approvals"
docker exec ccw-erp-postgres-staging psql -U ccw_staging -d ccw_erp_staging -c "\d products"

# Check extensions
docker exec ccw-erp-postgres-staging psql -U ccw_staging -d ccw_erp_staging -c "\dx"
```

---

## Database Backup Considerations

### Embedding Data

Vector embeddings are **large** (~6KB per product):
- 1,000 products = ~6MB of embedding data
- 10,000 products = ~60MB
- 100,000 products = ~600MB

**Backup Strategy**:
1. **Full Backup**: Include embeddings in production backups
2. **Selective Backup**: Exclude embeddings for dev/staging (regenerate on-demand)
3. **Embedding Cache**: Store embeddings separately if needed

```bash
# Backup excluding embeddings (faster, smaller)
pg_dump -U ccw_staging ccw_erp_staging \
  --exclude-table-data=products \
  > backup_no_embeddings.sql

# Backup only product data without embeddings
pg_dump -U ccw_staging ccw_erp_staging \
  --table=products \
  --exclude-column=embedding \
  > backup_products_no_vectors.sql
```

---

## Security Considerations

### Row-Level Security (Future)

Consider adding RLS policies for approvals:

```sql
-- Enable RLS on approvals table
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;

-- Users can only see approvals they requested or are assigned to approve
CREATE POLICY approvals_view_policy ON approvals
FOR SELECT
USING (
    requested_by = current_user_id()
    OR id IN (
        SELECT approval_id FROM approval_steps
        WHERE approver_id = current_user_id()
    )
);
```

### API Rate Limiting

Semantic search queries are **expensive** (OpenAI API costs):
- Implement rate limiting on search endpoints
- Cache query embeddings for common searches
- Consider batch embedding generation for new products

---

## Testing

### Migration Tests

```python
# tests/db/test_migrations.py
import pytest
from alembic import command
from alembic.config import Config

def test_migrations_upgrade():
    """Test all migrations can be applied"""
    config = Config("alembic.ini")
    command.upgrade(config, "head")

def test_migrations_downgrade():
    """Test all migrations can be rolled back"""
    config = Config("alembic.ini")
    command.downgrade(config, "base")
```

### Approval Workflow Tests

```python
# tests/api/test_approvals.py
async def test_create_approval():
    """Test approval creation"""
    approval = Approval(
        approval_type="quote_approval",
        entity_id=quote_id,
        entity_type="quote",
        total_steps=2,
        requested_by=user_id
    )
    session.add(approval)
    await session.commit()

    assert approval.id is not None
    assert approval.status == "pending"
    assert approval.current_step == 0

async def test_approval_cascade_delete():
    """Test cascade delete of approval steps"""
    # Create approval with steps
    approval = create_test_approval()
    step1 = create_test_step(approval.id, step_number=1)
    step2 = create_test_step(approval.id, step_number=2)

    # Delete approval
    await session.delete(approval)
    await session.commit()

    # Verify steps are deleted
    steps = await session.execute(
        select(ApprovalStep).where(ApprovalStep.approval_id == approval.id)
    )
    assert len(steps.all()) == 0
```

### Semantic Search Tests

```python
# tests/api/test_semantic_search.py
async def test_semantic_search():
    """Test vector similarity search"""
    # Create test products with embeddings
    products = create_test_products_with_embeddings()

    # Search
    results = await search_products("power tools", session)

    assert len(results) > 0
    assert all(r.distance < 0.5 for r in results)  # Similarity threshold

async def test_embedding_generation():
    """Test embedding generation for new products"""
    product = Product(name="Test Tool", description="A test product")
    await generate_product_embedding(product, session)

    assert product.embedding is not None
    assert len(product.embedding) == 1536
```

---

## Troubleshooting

### Common Issues

#### 1. Migration Failed: pgvector Extension Missing

**Error**: `ERROR: type "vector" does not exist`

**Solution**:
```bash
# Install pgvector extension
docker exec ccw-erp-postgres-staging psql -U ccw_staging -d ccw_erp_staging -c "CREATE EXTENSION vector;"
```

#### 2. Index Creation Fails

**Error**: `ERROR: could not create index`

**Solution**: Check that products have embeddings
```sql
-- Add embeddings to existing products
UPDATE products
SET embedding = generate_embedding(name || ' ' || description)
WHERE embedding IS NULL;
```

#### 3. Slow Semantic Search

**Issue**: Queries take > 100ms

**Solutions**:
```sql
-- 1. Adjust IVFFlat probes (trade accuracy for speed)
SET ivfflat.probes = 5;  -- Reduce from 10 to 5

-- 2. Rebuild index with more lists
DROP INDEX ix_products_embedding;
CREATE INDEX ix_products_embedding ON products
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 200);

-- 3. Upgrade to HNSW index (requires pgvector 0.5.0+)
CREATE INDEX ix_products_embedding ON products
USING hnsw (embedding vector_cosine_ops);
```

---

## References

- **Alembic Documentation**: https://alembic.sqlalchemy.org/
- **pgvector Documentation**: https://github.com/pgvector/pgvector
- **OpenAI Embeddings**: https://platform.openai.com/docs/guides/embeddings
- **SQLAlchemy Async**: https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html

---

**Last Updated**: 2026-02-02
**Schema Version**: 002_add_semantic_search
**Database**: ccw_erp_staging (PostgreSQL 15)
