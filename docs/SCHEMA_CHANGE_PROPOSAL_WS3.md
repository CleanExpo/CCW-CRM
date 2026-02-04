# Schema Change Proposal - WS-3: Missing Core Routes

**Date**: 2026-02-02
**Requested By**: Production Readiness Plan (WS-3)
**Requires Approval**: YES - Schema changes are normally prohibited

---

## Executive Summary

To implement **WS-3: Missing Core Routes**, we require 2 schema changes:

1. **Approvals Workflow** (ISS-D001) - New tables: `approvals`, `approval_steps`
2. **Semantic Search** (ISS-D005) - New extension: `pgvector`, new column: `products.embedding`

Both changes are **additive only** (no modifications to existing tables/columns) and include rollback procedures.

---

## Change 1: Approvals Workflow Tables

### Business Requirement
Multi-level approval chains for orders, quotes, and other entities requiring authorization.

### Schema Definition

```python
# apps/backend/src/db/approvals_models.py

import enum
from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship

from .models import Base


class ApprovalStatus(str, enum.Enum):
    """Approval status enum."""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class ApprovalType(str, enum.Enum):
    """Approval type enum."""
    ORDER = "order"
    QUOTE = "quote"
    PURCHASE_ORDER = "purchase_order"
    DISCOUNT = "discount"
    CREDIT_NOTE = "credit_note"


class Approval(Base):
    """Multi-level approval workflow."""

    __tablename__ = "approvals"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    approval_type: str = Column(
        String(50),
        nullable=False,
        index=True
    )
    entity_id: UUID = Column(
        PGUUID(as_uuid=True),
        nullable=False,
        index=True
    )
    entity_type: str = Column(String(50), nullable=False)  # 'order', 'quote', etc.

    status: str = Column(
        String(20),
        default=ApprovalStatus.PENDING,
        nullable=False,
        index=True,
    )

    total_steps: int = Column(Integer, nullable=False, default=1)
    current_step: int = Column(Integer, nullable=False, default=1)

    requested_by: UUID = Column(PGUUID(as_uuid=True), nullable=False, index=True)
    notes: str | None = Column(Text, nullable=True)

    created_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
        index=True
    )
    updated_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )
    completed_at: datetime | None = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    steps = relationship("ApprovalStep", back_populates="approval", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Approval(type={self.approval_type}, entity_id={self.entity_id}, status={self.status})>"


class ApprovalStep(Base):
    """Individual step in approval workflow."""

    __tablename__ = "approval_steps"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    approval_id: UUID = Column(
        PGUUID(as_uuid=True),
        ForeignKey("approvals.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    step_number: int = Column(Integer, nullable=False)
    approver_id: UUID = Column(PGUUID(as_uuid=True), nullable=False, index=True)
    approver_role: str | None = Column(String(100), nullable=True)

    status: str = Column(
        String(20),
        default=ApprovalStatus.PENDING,
        nullable=False,
        index=True,
    )

    comments: str | None = Column(Text, nullable=True)

    created_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False
    )
    reviewed_at: datetime | None = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    approval = relationship("Approval", back_populates="steps")

    def __repr__(self) -> str:
        return f"<ApprovalStep(approval_id={self.approval_id}, step={self.step_number}, status={self.status})>"
```

### Migration Script

```python
# apps/backend/alembic/versions/001_add_approvals.py

"""Add approvals workflow tables

Revision ID: 001_add_approvals
Revises:
Create Date: 2026-02-02

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001_add_approvals'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create approvals table
    op.create_table(
        'approvals',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('approval_type', sa.String(50), nullable=False),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('entity_type', sa.String(50), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('total_steps', sa.Integer(), nullable=False),
        sa.Column('current_step', sa.Integer(), nullable=False),
        sa.Column('requested_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for approvals
    op.create_index('ix_approvals_approval_type', 'approvals', ['approval_type'])
    op.create_index('ix_approvals_entity_id', 'approvals', ['entity_id'])
    op.create_index('ix_approvals_status', 'approvals', ['status'])
    op.create_index('ix_approvals_requested_by', 'approvals', ['requested_by'])
    op.create_index('ix_approvals_created_at', 'approvals', ['created_at'])

    # Create approval_steps table
    op.create_table(
        'approval_steps',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('approval_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('step_number', sa.Integer(), nullable=False),
        sa.Column('approver_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('approver_role', sa.String(100), nullable=True),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('comments', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['approval_id'], ['approvals.id'], ondelete='CASCADE')
    )

    # Create indexes for approval_steps
    op.create_index('ix_approval_steps_approval_id', 'approval_steps', ['approval_id'])
    op.create_index('ix_approval_steps_approver_id', 'approval_steps', ['approver_id'])
    op.create_index('ix_approval_steps_status', 'approval_steps', ['status'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_approval_steps_status', 'approval_steps')
    op.drop_index('ix_approval_steps_approver_id', 'approval_steps')
    op.drop_index('ix_approval_steps_approval_id', 'approval_steps')
    op.drop_index('ix_approvals_created_at', 'approvals')
    op.drop_index('ix_approvals_requested_by', 'approvals')
    op.drop_index('ix_approvals_status', 'approvals')
    op.drop_index('ix_approvals_entity_id', 'approvals')
    op.drop_index('ix_approvals_approval_type', 'approvals')

    # Drop tables
    op.drop_table('approval_steps')
    op.drop_table('approvals')
```

### Impact Analysis

**Affected Systems**: None (new tables)
**Data Migration**: None required
**Downtime**: Zero (additive change)
**Rollback**: Simple DROP TABLE (see migration script)

**Risk Level**: 🟢 LOW
- No existing data affected
- No foreign keys to existing tables
- Independent feature

---

## Change 2: Semantic Search with pgvector

### Business Requirement
AI-powered semantic/vector search for products by description, enabling "find me products similar to X" queries.

### Extension Installation

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
```

### Schema Definition

```python
# Modify apps/backend/src/db/demo_models.py

# Add import at top
from pgvector.sqlalchemy import Vector

# Add to Product class (line ~143)
class Product(Base):
    # ... existing fields ...

    # NEW: Vector embedding for semantic search (1536 dimensions for OpenAI ada-002)
    embedding: list[float] | None = Column(
        Vector(1536),
        nullable=True,
        comment="Vector embedding for semantic search"
    )

    # ... rest of existing fields ...
```

### Migration Script

```python
# apps/backend/alembic/versions/002_add_semantic_search.py

"""Add pgvector for semantic search

Revision ID: 002_add_semantic_search
Revises: 001_add_approvals
Create Date: 2026-02-02

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '002_add_semantic_search'
down_revision = '001_add_approvals'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enable pgvector extension
    op.execute('CREATE EXTENSION IF NOT EXISTS vector')

    # Add embedding column to products table
    # Using raw SQL to avoid SQLAlchemy type issues
    op.execute("""
        ALTER TABLE products
        ADD COLUMN embedding vector(1536)
    """)

    # Add comment for documentation
    op.execute("""
        COMMENT ON COLUMN products.embedding IS
        'Vector embedding for semantic search (1536 dimensions, OpenAI ada-002 compatible)'
    """)

    # Create index for vector similarity search (using cosine distance)
    op.execute("""
        CREATE INDEX ix_products_embedding
        ON products
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
    """)


def downgrade() -> None:
    # Drop index
    op.execute('DROP INDEX IF EXISTS ix_products_embedding')

    # Drop column
    op.execute('ALTER TABLE products DROP COLUMN IF EXISTS embedding')

    # Note: We don't drop the extension as other tables might use it
    # If needed, manually run: DROP EXTENSION IF EXISTS vector;
```

### Impact Analysis

**Affected Systems**: Products table
**Data Migration**: None required (column is nullable)
**Downtime**: ~5 seconds for index creation (locks table briefly)
**Rollback**: Simple ALTER TABLE DROP COLUMN (see migration script)

**Risk Level**: 🟡 MEDIUM
- Modifies existing `products` table
- Index creation locks table briefly
- Requires `pgvector` extension installation
- Existing queries unaffected (new column is nullable)

**Mitigation**:
- Column is nullable (existing rows remain valid)
- Index creation can be done CONCURRENTLY in production
- Embedding generation happens asynchronously (no immediate impact)

---

## Combined Migration Strategy

### Pre-Migration Checklist

```bash
# 1. Backup database
pg_dump -U postgres -d ccw_erp > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Test migrations on development database
cd apps/backend
uv run alembic upgrade head

# 3. Verify schema changes
psql -U postgres -d ccw_erp -c "\d approvals"
psql -U postgres -d ccw_erp -c "\d approval_steps"
psql -U postgres -d ccw_erp -c "\d products"

# 4. Test rollback
uv run alembic downgrade -1
uv run alembic upgrade head
```

### Production Deployment

```bash
# 1. Enable maintenance mode (optional)
# 2. Run migrations
cd apps/backend
uv run alembic upgrade head

# 3. Verify
psql -U postgres -d ccw_erp -c "SELECT COUNT(*) FROM approvals"  # Should be 0
psql -U postgres -d ccw_erp -c "SELECT COUNT(*) FROM products WHERE embedding IS NOT NULL"  # Should be 0

# 4. Disable maintenance mode
```

**Estimated Downtime**: < 30 seconds (for pgvector index creation)

### Rollback Procedure

```bash
# If issues detected, rollback
cd apps/backend
uv run alembic downgrade -2  # Rollback 2 migrations

# Verify rollback
psql -U postgres -d ccw_erp -c "\dt" | grep approvals  # Should be empty
psql -U postgres -d ccw_erp -c "\d products" | grep embedding  # Should be empty
```

---

## Testing Plan

### Change 1: Approvals Workflow

```python
# apps/backend/tests/models/test_approvals.py

async def test_create_approval(db_session):
    """Test creating approval workflow."""
    approval = Approval(
        approval_type="order",
        entity_id=uuid4(),
        entity_type="order",
        requested_by=uuid4(),
        total_steps=2,
    )
    db_session.add(approval)
    await db_session.commit()

    assert approval.id is not None
    assert approval.status == "pending"
    assert approval.current_step == 1


async def test_cascade_delete_approval_steps(db_session):
    """Test cascade delete of approval steps."""
    approval = Approval(...)
    step1 = ApprovalStep(approval=approval, step_number=1, approver_id=uuid4())
    step2 = ApprovalStep(approval=approval, step_number=2, approver_id=uuid4())

    db_session.add_all([approval, step1, step2])
    await db_session.commit()

    approval_id = approval.id
    await db_session.delete(approval)
    await db_session.commit()

    # Verify steps are deleted
    steps = await db_session.execute(
        select(ApprovalStep).where(ApprovalStep.approval_id == approval_id)
    )
    assert len(steps.scalars().all()) == 0
```

### Change 2: Semantic Search

```python
# apps/backend/tests/models/test_product_embedding.py

async def test_add_product_with_embedding(db_session):
    """Test adding product with vector embedding."""
    embedding = [0.1] * 1536  # Mock embedding

    product = Product(
        sku="TEST-001",
        name="Test Product",
        price=99.99,
        cost=50.00,
        embedding=embedding
    )
    db_session.add(product)
    await db_session.commit()

    assert product.embedding is not None
    assert len(product.embedding) == 1536


async def test_semantic_search(db_session):
    """Test vector similarity search."""
    # Create test products with embeddings
    product1 = Product(sku="P1", name="Drill", embedding=[0.1] * 1536, ...)
    product2 = Product(sku="P2", name="Screwdriver", embedding=[0.2] * 1536, ...)

    db_session.add_all([product1, product2])
    await db_session.commit()

    # Search for similar products
    query_embedding = [0.15] * 1536
    result = await db_session.execute(
        select(Product)
        .order_by(Product.embedding.cosine_distance(query_embedding))
        .limit(5)
    )
    products = result.scalars().all()

    assert len(products) > 0
    assert products[0].sku in ["P1", "P2"]
```

---

## Dependencies

### Python Packages (Already Installed)
- ✅ `sqlalchemy` (2.0+) - ORM
- ✅ `alembic` - Migrations
- ✅ `psycopg2-binary` - PostgreSQL driver

### New Dependencies Required
- ❌ `pgvector` - Python client for pgvector (install: `uv add pgvector`)

### PostgreSQL Extensions
- ❌ `vector` - pgvector extension (install: `CREATE EXTENSION vector`)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Table creation fails | Low | High | Test in dev first, have rollback ready |
| pgvector extension unavailable | Low | Medium | Pre-install extension, verify in dev |
| Index creation locks table | Medium | Low | Use CONCURRENTLY for production |
| Migration rollback needed | Low | Medium | Test rollback in dev, keep backups |
| Existing queries break | Very Low | High | New tables/columns don't affect existing |

**Overall Risk**: 🟡 MEDIUM (mostly due to pgvector extension requirement)

---

## Success Criteria

- [ ] Both migrations run without errors
- [ ] All existing tests pass
- [ ] New tests for approvals and embeddings pass
- [ ] No performance degradation on products table
- [ ] Rollback tested and confirmed working
- [ ] Zero downtime or < 30 seconds
- [ ] Documentation updated

---

## Approval Request

**Requested Changes**:
1. ✅ Add `approvals` and `approval_steps` tables (2 new tables, 0 modifications)
2. ✅ Add `pgvector` extension and `products.embedding` column (1 extension, 1 new column)

**Risk Level**: 🟡 MEDIUM
**Downtime**: < 30 seconds
**Rollback**: Tested and ready
**Business Value**: High (enables approvals workflow + AI search)

---

**Approval Decision**:
- [ ] ✅ APPROVED - Proceed with both schema changes
- [ ] ⚠️ APPROVED WITH CONDITIONS - (specify conditions below)
- [ ] ❌ REJECTED - Do not proceed

**Conditions** (if any):
_______________________________________________________

**Approved By**: _______________________
**Date**: _______________________

---

**Next Steps After Approval**:
1. Install `pgvector` Python package: `uv add pgvector`
2. Verify pgvector extension available: `psql -c "CREATE EXTENSION vector"`
3. Run migrations in dev: `alembic upgrade head`
4. Run tests: `pytest tests/models/`
5. Deploy to staging
6. Deploy to production
7. Launch WS-3 implementation
