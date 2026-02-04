# API Implementation Guide - Approvals & Semantic Search

This guide provides step-by-step instructions for implementing API endpoints for the new approval workflow and semantic search features.

---

## Table of Contents

1. [Approvals API](#approvals-api)
2. [Semantic Search API](#semantic-search-api)
3. [Background Jobs](#background-jobs)
4. [Testing](#testing)
5. [Frontend Integration](#frontend-integration)

---

## Approvals API

### Endpoint Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/approvals` | Create new approval request |
| GET | `/api/approvals/{id}` | Get approval details |
| GET | `/api/approvals` | List approvals (with filters) |
| GET | `/api/approvals/my-pending` | Get pending approvals for current user |
| POST | `/api/approvals/{id}/steps/{step_id}/approve` | Approve a step |
| POST | `/api/approvals/{id}/steps/{step_id}/reject` | Reject a step |
| DELETE | `/api/approvals/{id}` | Cancel/delete approval |

---

### Implementation

**File**: `apps/backend/src/api/routes/approvals.py`

```python
from typing import Annotated, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, or_, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone
from pydantic import BaseModel, Field

from src.config.database import get_async_db
from src.db.approvals_models import Approval, ApprovalStep
from src.api.routes.demo_auth import get_current_user

router = APIRouter(prefix="/api/approvals", tags=["Approvals"])

# ============================================================================
# Pydantic Models (Request/Response)
# ============================================================================

class ApprovalStepCreate(BaseModel):
    """Create approval step"""
    step_number: int = Field(..., ge=1)
    approver_id: UUID
    approver_role: str | None = None
    deadline: datetime | None = None

class ApprovalCreate(BaseModel):
    """Create approval request"""
    approval_type: str = Field(..., max_length=50)
    entity_id: UUID
    entity_type: str = Field(..., max_length=50)
    notes: str | None = None
    steps: List[ApprovalStepCreate] = Field(..., min_items=1)

class ApprovalStepResponse(BaseModel):
    """Approval step response"""
    id: UUID
    step_number: int
    approver_id: UUID
    approver_role: str | None
    status: str
    comments: str | None
    created_at: datetime
    completed_at: datetime | None
    deadline: datetime | None

    class Config:
        from_attributes = True

class ApprovalResponse(BaseModel):
    """Approval response"""
    id: UUID
    approval_type: str
    entity_id: UUID
    entity_type: str
    status: str
    total_steps: int
    current_step: int
    requested_by: UUID
    notes: str | None
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None
    steps: List[ApprovalStepResponse]

    class Config:
        from_attributes = True

class ApprovalActionRequest(BaseModel):
    """Approve/reject step request"""
    comments: str | None = None

# ============================================================================
# Endpoints
# ============================================================================

@router.post("", response_model=ApprovalResponse, status_code=status.HTTP_201_CREATED)
async def create_approval(
    data: ApprovalCreate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user = Depends(get_current_user),
):
    """
    Create a new approval request with steps.

    **Example**:
    ```json
    {
      "approval_type": "quote_approval",
      "entity_id": "123e4567-e89b-12d3-a456-426614174000",
      "entity_type": "quote",
      "notes": "Large order requiring approval",
      "steps": [
        {
          "step_number": 1,
          "approver_id": "...",
          "approver_role": "sales_manager"
        },
        {
          "step_number": 2,
          "approver_id": "...",
          "approver_role": "sales_director"
        }
      ]
    }
    ```
    """
    # Validate step numbers are sequential
    step_numbers = sorted([s.step_number for s in data.steps])
    if step_numbers != list(range(1, len(data.steps) + 1)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Step numbers must be sequential starting from 1"
        )

    # Create approval
    approval = Approval(
        approval_type=data.approval_type,
        entity_id=data.entity_id,
        entity_type=data.entity_type,
        status="pending",
        total_steps=len(data.steps),
        current_step=0,
        requested_by=current_user.id,
        notes=data.notes,
    )
    db.add(approval)
    await db.flush()  # Get approval.id

    # Create steps
    steps = [
        ApprovalStep(
            approval_id=approval.id,
            step_number=s.step_number,
            approver_id=s.approver_id,
            approver_role=s.approver_role,
            status="pending",
            deadline=s.deadline,
        )
        for s in data.steps
    ]
    db.add_all(steps)
    await db.commit()

    # Reload with relationships
    await db.refresh(approval, ["steps"])

    return approval


@router.get("/{approval_id}", response_model=ApprovalResponse)
async def get_approval(
    approval_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user = Depends(get_current_user),
):
    """Get approval details by ID"""
    stmt = (
        select(Approval)
        .options(selectinload(Approval.steps))
        .where(Approval.id == approval_id)
    )

    result = await db.execute(stmt)
    approval = result.scalar_one_or_none()

    if not approval:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Approval not found"
        )

    return approval


@router.get("", response_model=List[ApprovalResponse])
async def list_approvals(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user = Depends(get_current_user),
    status_filter: str | None = Query(None, alias="status"),
    approval_type: str | None = None,
    entity_type: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
):
    """
    List approvals with optional filters.

    **Filters**:
    - `status`: pending, in_progress, approved, rejected
    - `approval_type`: quote_approval, order_approval, etc.
    - `entity_type`: quote, order, etc.
    """
    stmt = select(Approval).options(selectinload(Approval.steps))

    # Apply filters
    if status_filter:
        stmt = stmt.where(Approval.status == status_filter)
    if approval_type:
        stmt = stmt.where(Approval.approval_type == approval_type)
    if entity_type:
        stmt = stmt.where(Approval.entity_type == entity_type)

    # Pagination
    stmt = (
        stmt
        .order_by(Approval.created_at.desc())
        .limit(page_size)
        .offset((page - 1) * page_size)
    )

    result = await db.execute(stmt)
    approvals = result.scalars().all()

    return approvals


@router.get("/my-pending", response_model=List[ApprovalResponse])
async def get_my_pending_approvals(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user = Depends(get_current_user),
):
    """
    Get pending approval steps assigned to the current user.

    Returns approvals where:
    - User is assigned as approver in a pending step
    - Approval is in pending/in_progress status
    """
    stmt = (
        select(Approval)
        .join(ApprovalStep)
        .options(selectinload(Approval.steps))
        .where(
            and_(
                ApprovalStep.approver_id == current_user.id,
                ApprovalStep.status == "pending",
                Approval.status.in_(["pending", "in_progress"])
            )
        )
        .order_by(ApprovalStep.deadline.nullslast(), Approval.created_at)
    )

    result = await db.execute(stmt)
    approvals = result.unique().scalars().all()

    return approvals


@router.post("/{approval_id}/steps/{step_id}/approve", response_model=ApprovalResponse)
async def approve_step(
    approval_id: UUID,
    step_id: UUID,
    data: ApprovalActionRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user = Depends(get_current_user),
):
    """
    Approve an approval step.

    **Logic**:
    1. Verify user is assigned to this step
    2. Mark step as approved
    3. Update approval progress
    4. If all steps approved, mark approval as approved
    """
    # Get step
    stmt = (
        select(ApprovalStep)
        .options(selectinload(ApprovalStep.approval))
        .where(
            and_(
                ApprovalStep.id == step_id,
                ApprovalStep.approval_id == approval_id
            )
        )
    )
    result = await db.execute(stmt)
    step = result.scalar_one_or_none()

    if not step:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Approval step not found"
        )

    # Verify user is the assigned approver
    if step.approver_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not assigned to approve this step"
        )

    # Check step is pending
    if step.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Step is already {step.status}"
        )

    # Approve step
    step.status = "approved"
    step.comments = data.comments
    step.completed_at = datetime.now(timezone.utc)

    # Update approval
    approval = step.approval
    approval.current_step = step.step_number
    approval.updated_at = datetime.now(timezone.utc)

    # Check if approval is complete
    if approval.current_step >= approval.total_steps:
        approval.status = "approved"
        approval.completed_at = datetime.now(timezone.utc)
    elif approval.status == "pending":
        approval.status = "in_progress"

    await db.commit()
    await db.refresh(approval, ["steps"])

    return approval


@router.post("/{approval_id}/steps/{step_id}/reject", response_model=ApprovalResponse)
async def reject_step(
    approval_id: UUID,
    step_id: UUID,
    data: ApprovalActionRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user = Depends(get_current_user),
):
    """
    Reject an approval step.

    **Logic**:
    1. Verify user is assigned to this step
    2. Mark step as rejected
    3. Mark entire approval as rejected (workflow stops)
    """
    # Get step
    stmt = (
        select(ApprovalStep)
        .options(selectinload(ApprovalStep.approval))
        .where(
            and_(
                ApprovalStep.id == step_id,
                ApprovalStep.approval_id == approval_id
            )
        )
    )
    result = await db.execute(stmt)
    step = result.scalar_one_or_none()

    if not step:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Approval step not found"
        )

    # Verify user is the assigned approver
    if step.approver_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not assigned to approve this step"
        )

    # Check step is pending
    if step.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Step is already {step.status}"
        )

    # Reject step
    step.status = "rejected"
    step.comments = data.comments or "Rejected"
    step.completed_at = datetime.now(timezone.utc)

    # Reject entire approval
    approval = step.approval
    approval.status = "rejected"
    approval.updated_at = datetime.now(timezone.utc)
    approval.completed_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(approval, ["steps"])

    return approval


@router.delete("/{approval_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_approval(
    approval_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user = Depends(get_current_user),
):
    """
    Cancel/delete an approval request.

    Only the user who requested approval can cancel it.
    Cascade deletes all approval steps.
    """
    stmt = select(Approval).where(Approval.id == approval_id)
    result = await db.execute(stmt)
    approval = result.scalar_one_or_none()

    if not approval:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Approval not found"
        )

    # Only requester can cancel
    if approval.requested_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the requester can cancel this approval"
        )

    # Can't delete completed approvals
    if approval.status in ["approved", "rejected"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete completed approval"
        )

    await db.delete(approval)  # Cascade deletes steps
    await db.commit()
```

---

## Semantic Search API

### Endpoint Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products/search` | Semantic search for products |
| GET | `/api/products/{id}/similar` | Get similar products |
| POST | `/api/products/{id}/generate-embedding` | Generate embedding for one product |
| POST | `/api/products/bulk-generate-embeddings` | Batch generate embeddings |
| GET | `/api/products/embedding-stats` | Get embedding coverage stats |

---

### Implementation

**File**: `apps/backend/src/api/routes/semantic_search.py`

```python
from typing import Annotated, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status, BackgroundTasks
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
import openai
import os

from src.config.database import get_async_db
from src.db.demo_models import Product

router = APIRouter(prefix="/api/products", tags=["Semantic Search"])

# OpenAI configuration
openai.api_key = os.getenv("OPENAI_API_KEY")
EMBEDDING_MODEL = "text-embedding-ada-002"
EMBEDDING_DIMENSIONS = 1536

# ============================================================================
# Pydantic Models
# ============================================================================

class SearchResult(BaseModel):
    """Search result with similarity score"""
    product: dict
    similarity_score: float = Field(..., description="Cosine similarity (0-1, higher is better)")

class EmbeddingStats(BaseModel):
    """Embedding coverage statistics"""
    total_products: int
    products_with_embeddings: int
    coverage_percent: float
    products_missing_embeddings: int

# ============================================================================
# Helper Functions
# ============================================================================

async def generate_embedding(text: str) -> List[float]:
    """Generate embedding using OpenAI"""
    try:
        response = openai.Embedding.create(
            model=EMBEDDING_MODEL,
            input=text
        )
        return response['data'][0]['embedding']
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate embedding: {str(e)}"
        )

def product_to_text(product: Product) -> str:
    """Convert product to searchable text"""
    parts = [
        product.name,
        product.description or "",
        product.category,
        product.sku,
    ]
    return " ".join(filter(None, parts))

# ============================================================================
# Endpoints
# ============================================================================

@router.get("/search", response_model=List[SearchResult])
async def semantic_search(
    q: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(10, ge=1, le=50),
    category: str | None = None,
    db: Annotated[AsyncSession, Depends(get_async_db)],
):
    """
    Semantic search for products using natural language.

    **Examples**:
    - `q=heavy duty power tools for construction`
    - `q=safety equipment for high voltage work`
    - `q=tools for woodworking beginners`

    Returns products ranked by semantic similarity.
    """
    # Generate query embedding
    query_embedding = await generate_embedding(q)

    # Build query
    stmt = (
        select(
            Product,
            Product.embedding.cosine_distance(query_embedding).label("distance")
        )
        .where(Product.embedding.isnot(None))
    )

    # Apply category filter if provided
    if category:
        stmt = stmt.where(Product.category == category)

    # Order by similarity and limit
    stmt = stmt.order_by("distance").limit(limit)

    # Execute
    result = await db.execute(stmt)
    rows = result.all()

    # Convert to response format
    results = []
    for product, distance in rows:
        results.append(SearchResult(
            product={
                "id": str(product.id),
                "sku": product.sku,
                "name": product.name,
                "description": product.description,
                "category": product.category,
                "price": float(product.price),
                "stock": product.stock,
            },
            similarity_score=1.0 - distance  # Convert distance to similarity
        ))

    return results


@router.get("/{product_id}/similar", response_model=List[SearchResult])
async def get_similar_products(
    product_id: UUID,
    limit: int = Query(5, ge=1, le=20),
    db: Annotated[AsyncSession, Depends(get_async_db)],
):
    """
    Get products similar to a specific product.

    Useful for "You may also like" recommendations.
    """
    # Get source product
    product = await db.get(Product, product_id)

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )

    if not product.embedding:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product does not have an embedding. Generate one first."
        )

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

    result = await db.execute(stmt)
    rows = result.all()

    # Convert to response format
    results = []
    for similar_product, distance in rows:
        results.append(SearchResult(
            product={
                "id": str(similar_product.id),
                "sku": similar_product.sku,
                "name": similar_product.name,
                "description": similar_product.description,
                "category": similar_product.category,
                "price": float(similar_product.price),
                "stock": similar_product.stock,
            },
            similarity_score=1.0 - distance
        ))

    return results


@router.post("/{product_id}/generate-embedding", status_code=status.HTTP_200_OK)
async def generate_product_embedding(
    product_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
):
    """
    Generate embedding for a single product.

    Use this when adding new products or updating product details.
    """
    product = await db.get(Product, product_id)

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )

    # Generate embedding
    text = product_to_text(product)
    embedding = await generate_embedding(text)

    # Store in database
    product.embedding = embedding
    await db.commit()

    return {"message": "Embedding generated successfully", "product_id": str(product_id)}


@router.post("/bulk-generate-embeddings")
async def bulk_generate_embeddings(
    background_tasks: BackgroundTasks,
    limit: int = Query(100, ge=1, le=1000),
    db: Annotated[AsyncSession, Depends(get_async_db)],
):
    """
    Generate embeddings for products that don't have them.

    Processes in background to avoid timeouts.
    Limits to prevent excessive API costs.
    """
    # Count products missing embeddings
    stmt = select(func.count()).select_from(Product).where(Product.embedding.is_(None))
    result = await db.execute(stmt)
    total_missing = result.scalar()

    if total_missing == 0:
        return {"message": "All products already have embeddings"}

    # Get products to process
    stmt = (
        select(Product)
        .where(Product.embedding.is_(None))
        .limit(limit)
    )
    result = await db.execute(stmt)
    products = result.scalars().all()

    # Process in background
    async def process_embeddings():
        for product in products:
            try:
                text = product_to_text(product)
                embedding = await generate_embedding(text)
                product.embedding = embedding
                await db.commit()
            except Exception as e:
                print(f"Error generating embedding for {product.id}: {e}")
                continue

    background_tasks.add_task(process_embeddings)

    return {
        "message": f"Generating embeddings for {len(products)} products in background",
        "total_missing": total_missing,
        "processing": len(products)
    }


@router.get("/embedding-stats", response_model=EmbeddingStats)
async def get_embedding_stats(
    db: Annotated[AsyncSession, Depends(get_async_db)],
):
    """
    Get embedding coverage statistics.

    Useful for monitoring embedding generation progress.
    """
    # Get counts
    stmt_total = select(func.count()).select_from(Product)
    stmt_with_embedding = select(func.count()).select_from(Product).where(Product.embedding.isnot(None))

    total = (await db.execute(stmt_total)).scalar()
    with_embedding = (await db.execute(stmt_with_embedding)).scalar()

    missing = total - with_embedding
    coverage = (with_embedding / total * 100) if total > 0 else 0

    return EmbeddingStats(
        total_products=total,
        products_with_embeddings=with_embedding,
        coverage_percent=round(coverage, 2),
        products_missing_embeddings=missing
    )
```

---

## Background Jobs

### Automatic Embedding Generation

**File**: `apps/backend/src/services/embedding_service.py`

```python
"""
Background service for generating product embeddings.

Run this as a cron job or background worker to keep embeddings up-to-date.
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import openai
import os
from src.db.demo_models import Product
from src.config.database import get_async_db

openai.api_key = os.getenv("OPENAI_API_KEY")

async def generate_missing_embeddings(limit: int = 100):
    """Generate embeddings for products that don't have them"""

    async for db in get_async_db():
        # Get products without embeddings
        stmt = select(Product).where(Product.embedding.is_(None)).limit(limit)
        result = await db.execute(stmt)
        products = result.scalars().all()

        if not products:
            print("No products missing embeddings")
            return

        print(f"Generating embeddings for {len(products)} products...")

        for product in products:
            try:
                # Create text representation
                text = f"{product.name} {product.description} {product.category}"

                # Generate embedding
                response = openai.Embedding.create(
                    model="text-embedding-ada-002",
                    input=text
                )

                # Store embedding
                product.embedding = response['data'][0]['embedding']
                await db.commit()

                print(f"✓ Generated embedding for {product.sku}")

            except Exception as e:
                print(f"✗ Error for {product.sku}: {e}")
                continue

        print(f"Completed {len(products)} products")

if __name__ == "__main__":
    import asyncio
    asyncio.run(generate_missing_embeddings())
```

**Cron Job** (run daily):
```bash
# Add to crontab
0 2 * * * cd /app/backend && python -m src.services.embedding_service
```

---

## Testing

### Test Approvals API

**File**: `apps/backend/tests/api/test_approvals.py`

```python
import pytest
from uuid import uuid4
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_create_approval(client: AsyncClient, auth_headers):
    """Test creating an approval request"""

    payload = {
        "approval_type": "quote_approval",
        "entity_id": str(uuid4()),
        "entity_type": "quote",
        "notes": "Test approval",
        "steps": [
            {
                "step_number": 1,
                "approver_id": str(uuid4())
            },
            {
                "step_number": 2,
                "approver_id": str(uuid4())
            }
        ]
    }

    response = await client.post("/api/approvals", json=payload, headers=auth_headers)

    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "pending"
    assert data["total_steps"] == 2
    assert data["current_step"] == 0
    assert len(data["steps"]) == 2


@pytest.mark.asyncio
async def test_approve_step(client: AsyncClient, auth_headers, test_approval):
    """Test approving a step"""

    step_id = test_approval["steps"][0]["id"]
    approval_id = test_approval["id"]

    response = await client.post(
        f"/api/approvals/{approval_id}/steps/{step_id}/approve",
        json={"comments": "Looks good"},
        headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "in_progress"
    assert data["current_step"] == 1


@pytest.mark.asyncio
async def test_reject_step(client: AsyncClient, auth_headers, test_approval):
    """Test rejecting a step"""

    step_id = test_approval["steps"][0]["id"]
    approval_id = test_approval["id"]

    response = await client.post(
        f"/api/approvals/{approval_id}/steps/{step_id}/reject",
        json={"comments": "Pricing too high"},
        headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "rejected"
```

### Test Semantic Search API

**File**: `apps/backend/tests/api/test_semantic_search.py`

```python
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_semantic_search(client: AsyncClient):
    """Test semantic search"""

    response = await client.get("/api/products/search?q=power+drill&limit=5")

    assert response.status_code == 200
    data = response.json()
    assert len(data) <= 5
    assert all("similarity_score" in item for item in data)
    assert all(0 <= item["similarity_score"] <= 1 for item in data)


@pytest.mark.asyncio
async def test_similar_products(client: AsyncClient, test_product_with_embedding):
    """Test finding similar products"""

    product_id = test_product_with_embedding["id"]

    response = await client.get(f"/api/products/{product_id}/similar?limit=3")

    assert response.status_code == 200
    data = response.json()
    assert len(data) <= 3
    assert all(item["product"]["id"] != product_id for item in data)


@pytest.mark.asyncio
async def test_generate_embedding(client: AsyncClient, test_product):
    """Test generating embedding for a product"""

    product_id = test_product["id"]

    response = await client.post(f"/api/products/{product_id}/generate-embedding")

    assert response.status_code == 200
    assert "message" in response.json()


@pytest.mark.asyncio
async def test_embedding_stats(client: AsyncClient):
    """Test getting embedding statistics"""

    response = await client.get("/api/products/embedding-stats")

    assert response.status_code == 200
    data = response.json()
    assert "total_products" in data
    assert "products_with_embeddings" in data
    assert "coverage_percent" in data
```

---

## Frontend Integration

### Approval Dashboard Component

**File**: `apps/web/app/(dashboard)/approvals/page.tsx`

```typescript
"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface Approval {
  id: string;
  approval_type: string;
  entity_type: string;
  status: string;
  total_steps: number;
  current_step: number;
  created_at: string;
  steps: ApprovalStep[];
}

interface ApprovalStep {
  id: string;
  step_number: number;
  status: string;
  comments: string | null;
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadApprovals();
  }, []);

  async function loadApprovals() {
    try {
      const data = await apiClient.get<Approval[]>("/api/approvals/my-pending");
      setApprovals(data);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(approvalId: string, stepId: string) {
    try {
      await apiClient.post(
        `/api/approvals/${approvalId}/steps/${stepId}/approve`,
        { comments: "Approved" }
      );
      toast({ title: "Success", description: "Approval step completed" });
      loadApprovals();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  }

  async function handleReject(approvalId: string, stepId: string) {
    try {
      await apiClient.post(
        `/api/approvals/${approvalId}/steps/${stepId}/reject`,
        { comments: "Rejected" }
      );
      toast({ title: "Success", description: "Approval rejected" });
      loadApprovals();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  }

  if (loading) return <div>Loading...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Pending Approvals</h1>

      {approvals.length === 0 ? (
        <p className="text-muted-foreground">No pending approvals</p>
      ) : (
        <div className="space-y-4">
          {approvals.map((approval) => {
            const pendingStep = approval.steps.find(s => s.status === "pending");

            return (
              <div key={approval.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="font-semibold">{approval.approval_type}</h3>
                    <p className="text-sm text-muted-foreground">
                      Step {approval.current_step + 1} of {approval.total_steps}
                    </p>
                  </div>
                  <Badge>{approval.status}</Badge>
                </div>

                {pendingStep && (
                  <div className="flex gap-2 mt-4">
                    <Button
                      onClick={() => handleApprove(approval.id, pendingStep.id)}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleReject(approval.id, pendingStep.id)}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

### Semantic Search Component

**File**: `apps/web/app/(dashboard)/products/components/SemanticSearch.tsx`

```typescript
"use client";

import { useState } from "react";
import { apiClient } from "@/lib/api/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface SearchResult {
  product: {
    id: string;
    name: string;
    description: string;
    price: number;
    sku: string;
  };
  similarity_score: number;
}

export function SemanticSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSearch() {
    if (!query.trim()) return;

    setLoading(true);
    try {
      const data = await apiClient.get<SearchResult[]>(
        `/api/products/search?q=${encodeURIComponent(query)}&limit=10`
      );
      setResults(data);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <Input
          placeholder="Search products naturally (e.g., 'heavy duty tools for construction')"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <Button onClick={handleSearch} disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </Button>
      </div>

      <div className="space-y-2">
        {results.map((result) => (
          <Card key={result.product.id} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{result.product.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {result.product.description}
                </p>
                <p className="text-sm">SKU: {result.product.sku}</p>
              </div>
              <div className="text-right">
                <p className="font-bold">${result.product.price}</p>
                <p className="text-xs text-muted-foreground">
                  Match: {(result.similarity_score * 100).toFixed(0)}%
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

---

## Next Steps

1. **Register Routes** - Add routers to `main.py`:
```python
from src.api.routes import approvals, semantic_search

app.include_router(approvals.router)
app.include_router(semantic_search.router)
```

2. **Environment Variables** - Add to `.env`:
```bash
OPENAI_API_KEY=sk-...
```

3. **Run Tests**:
```bash
cd apps/backend
pytest tests/api/test_approvals.py
pytest tests/api/test_semantic_search.py
```

4. **Deploy** - Run migrations on production:
```bash
alembic upgrade head
```

---

**Last Updated**: 2026-02-02
