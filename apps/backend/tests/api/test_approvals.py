"""
Tests for approval workflow API endpoints.
"""

from uuid import uuid4

import pytest


@pytest.mark.asyncio
async def test_create_approval(async_client, test_db):
    """Test creating an approval workflow."""
    # Create test user
    user_id = uuid4()
    entity_id = uuid4()

    # Create approval
    response = await async_client.post(
        "/api/approvals",
        json={
            "approval_type": "order",
            "entity_id": str(entity_id),
            "entity_type": "order",
            "total_steps": 2,
            "requested_by": str(user_id),
            "notes": "Test approval",
        },
    )

    assert response.status_code == 201
    data = response.json()

    assert data["approval_type"] == "order"
    assert data["entity_type"] == "order"
    assert data["status"] == "pending"
    assert data["total_steps"] == 2
    assert data["current_step"] == 1
    assert data["notes"] == "Test approval"
    assert "id" in data
    assert "created_at" in data


@pytest.mark.asyncio
async def test_create_approval_invalid_type(async_client, test_db):
    """Test creating approval with invalid type."""
    user_id = uuid4()
    entity_id = uuid4()

    response = await async_client.post(
        "/api/approvals",
        json={
            "approval_type": "invalid_type",
            "entity_id": str(entity_id),
            "entity_type": "order",
            "total_steps": 1,
            "requested_by": str(user_id),
        },
    )

    assert response.status_code == 400
    assert "Invalid approval type" in response.json()["detail"]


@pytest.mark.asyncio
async def test_list_approvals(async_client, test_db):
    """Test listing approvals with pagination."""
    # Create test approvals
    user_id = uuid4()

    for i in range(3):
        await async_client.post(
            "/api/approvals",
            json={
                "approval_type": "order",
                "entity_id": str(uuid4()),
                "entity_type": "order",
                "total_steps": 1,
                "requested_by": str(user_id),
                "notes": f"Test approval {i}",
            },
        )

    # List approvals
    response = await async_client.get("/api/approvals?page=1&page_size=10")

    assert response.status_code == 200
    data = response.json()

    assert "data" in data
    assert "total" in data
    assert "page" in data
    assert data["page"] == 1
    assert len(data["data"]) >= 3


@pytest.mark.asyncio
async def test_get_approval(async_client, test_db):
    """Test getting approval by ID."""
    user_id = uuid4()
    entity_id = uuid4()

    # Create approval
    create_response = await async_client.post(
        "/api/approvals",
        json={
            "approval_type": "quote",
            "entity_id": str(entity_id),
            "entity_type": "quote",
            "total_steps": 1,
            "requested_by": str(user_id),
        },
    )

    approval_id = create_response.json()["id"]

    # Get approval
    response = await async_client.get(f"/api/approvals/{approval_id}")

    assert response.status_code == 200
    data = response.json()

    assert data["id"] == approval_id
    assert data["approval_type"] == "quote"
    assert data["status"] == "pending"


@pytest.mark.asyncio
async def test_get_approval_not_found(async_client, test_db):
    """Test getting non-existent approval."""
    fake_id = uuid4()

    response = await async_client.get(f"/api/approvals/{fake_id}")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_add_approval_step(async_client, test_db):
    """Test adding approval step."""
    user_id = uuid4()
    approver_id = uuid4()
    entity_id = uuid4()

    # Create approval
    create_response = await async_client.post(
        "/api/approvals",
        json={
            "approval_type": "order",
            "entity_id": str(entity_id),
            "entity_type": "order",
            "total_steps": 2,
            "requested_by": str(user_id),
        },
    )

    approval_id = create_response.json()["id"]

    # Add step
    response = await async_client.post(
        f"/api/approvals/{approval_id}/steps",
        json={
            "step_number": 1,
            "approver_id": str(approver_id),
            "approver_role": "Manager",
        },
    )

    assert response.status_code == 201
    data = response.json()

    assert data["step_number"] == 1
    assert data["approver_role"] == "Manager"
    assert data["status"] == "pending"
    assert "id" in data


@pytest.mark.asyncio
async def test_add_approval_step_duplicate(async_client, test_db):
    """Test adding duplicate approval step."""
    user_id = uuid4()
    approver_id = uuid4()
    entity_id = uuid4()

    # Create approval
    create_response = await async_client.post(
        "/api/approvals",
        json={
            "approval_type": "order",
            "entity_id": str(entity_id),
            "entity_type": "order",
            "total_steps": 2,
            "requested_by": str(user_id),
        },
    )

    approval_id = create_response.json()["id"]

    # Add step
    await async_client.post(
        f"/api/approvals/{approval_id}/steps",
        json={
            "step_number": 1,
            "approver_id": str(approver_id),
        },
    )

    # Try to add same step again
    response = await async_client.post(
        f"/api/approvals/{approval_id}/steps",
        json={
            "step_number": 1,
            "approver_id": str(approver_id),
        },
    )

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_approve_step(async_client, test_db):
    """Test approving a step."""
    user_id = uuid4()
    approver_id = uuid4()
    entity_id = uuid4()

    # Create approval with 2 steps
    create_response = await async_client.post(
        "/api/approvals",
        json={
            "approval_type": "order",
            "entity_id": str(entity_id),
            "entity_type": "order",
            "total_steps": 2,
            "requested_by": str(user_id),
        },
    )

    approval_id = create_response.json()["id"]

    # Add step 1
    step_response = await async_client.post(
        f"/api/approvals/{approval_id}/steps",
        json={
            "step_number": 1,
            "approver_id": str(approver_id),
        },
    )

    step_id = step_response.json()["id"]

    # Approve step 1
    response = await async_client.put(
        f"/api/approvals/{approval_id}/steps/{step_id}",
        json={
            "action": "approve",
            "comments": "Looks good",
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "approved"
    assert data["comments"] == "Looks good"
    assert data["reviewed_at"] is not None

    # Check approval advanced to step 2
    approval_response = await async_client.get(f"/api/approvals/{approval_id}")
    approval_data = approval_response.json()

    assert approval_data["current_step"] == 2
    assert approval_data["status"] == "pending"  # Still pending (not all steps completed)


@pytest.mark.asyncio
async def test_reject_step(async_client, test_db):
    """Test rejecting a step."""
    user_id = uuid4()
    approver_id = uuid4()
    entity_id = uuid4()

    # Create approval
    create_response = await async_client.post(
        "/api/approvals",
        json={
            "approval_type": "order",
            "entity_id": str(entity_id),
            "entity_type": "order",
            "total_steps": 2,
            "requested_by": str(user_id),
        },
    )

    approval_id = create_response.json()["id"]

    # Add step
    step_response = await async_client.post(
        f"/api/approvals/{approval_id}/steps",
        json={
            "step_number": 1,
            "approver_id": str(approver_id),
        },
    )

    step_id = step_response.json()["id"]

    # Reject step
    response = await async_client.put(
        f"/api/approvals/{approval_id}/steps/{step_id}",
        json={
            "action": "reject",
            "comments": "Needs revision",
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "rejected"
    assert data["comments"] == "Needs revision"

    # Check approval is rejected
    approval_response = await async_client.get(f"/api/approvals/{approval_id}")
    approval_data = approval_response.json()

    assert approval_data["status"] == "rejected"
    assert approval_data["completed_at"] is not None


@pytest.mark.asyncio
async def test_complete_approval_workflow(async_client, test_db):
    """Test completing a full approval workflow."""
    user_id = uuid4()
    approver1_id = uuid4()
    approver2_id = uuid4()
    entity_id = uuid4()

    # Create approval with 2 steps
    create_response = await async_client.post(
        "/api/approvals",
        json={
            "approval_type": "purchase_order",
            "entity_id": str(entity_id),
            "entity_type": "purchase_order",
            "total_steps": 2,
            "requested_by": str(user_id),
        },
    )

    approval_id = create_response.json()["id"]

    # Add steps
    step1_response = await async_client.post(
        f"/api/approvals/{approval_id}/steps",
        json={
            "step_number": 1,
            "approver_id": str(approver1_id),
            "approver_role": "Manager",
        },
    )

    step2_response = await async_client.post(
        f"/api/approvals/{approval_id}/steps",
        json={
            "step_number": 2,
            "approver_id": str(approver2_id),
            "approver_role": "Director",
        },
    )

    # Approve step 1
    await async_client.put(
        f"/api/approvals/{approval_id}/steps/{step1_response.json()['id']}",
        json={
            "action": "approve",
            "comments": "Manager approved",
        },
    )

    # Approve step 2
    await async_client.put(
        f"/api/approvals/{approval_id}/steps/{step2_response.json()['id']}",
        json={
            "action": "approve",
            "comments": "Director approved",
        },
    )

    # Check approval is completed
    approval_response = await async_client.get(f"/api/approvals/{approval_id}")
    approval_data = approval_response.json()

    assert approval_data["status"] == "approved"
    assert approval_data["completed_at"] is not None
    assert len(approval_data["steps"]) == 2
    assert all(step["status"] == "approved" for step in approval_data["steps"])


@pytest.mark.asyncio
async def test_cancel_approval(async_client, test_db):
    """Test cancelling an approval."""
    user_id = uuid4()
    entity_id = uuid4()

    # Create approval
    create_response = await async_client.post(
        "/api/approvals",
        json={
            "approval_type": "order",
            "entity_id": str(entity_id),
            "entity_type": "order",
            "total_steps": 1,
            "requested_by": str(user_id),
        },
    )

    approval_id = create_response.json()["id"]

    # Cancel approval
    response = await async_client.delete(f"/api/approvals/{approval_id}")

    assert response.status_code == 204

    # Check approval is cancelled
    approval_response = await async_client.get(f"/api/approvals/{approval_id}")
    approval_data = approval_response.json()

    assert approval_data["status"] == "cancelled"
    assert approval_data["completed_at"] is not None


@pytest.mark.asyncio
async def test_get_pending_approvals(async_client, test_db):
    """Test getting pending approvals for an approver."""
    user_id = uuid4()
    approver_id = uuid4()
    entity_id = uuid4()

    # Create approval
    create_response = await async_client.post(
        "/api/approvals",
        json={
            "approval_type": "order",
            "entity_id": str(entity_id),
            "entity_type": "order",
            "total_steps": 1,
            "requested_by": str(user_id),
        },
    )

    approval_id = create_response.json()["id"]

    # Add step for approver
    await async_client.post(
        f"/api/approvals/{approval_id}/steps",
        json={
            "step_number": 1,
            "approver_id": str(approver_id),
        },
    )

    # Get pending approvals for approver
    response = await async_client.get(f"/api/approvals/pending?approver_id={approver_id}&page=1&page_size=10")

    assert response.status_code == 200
    data = response.json()

    assert "data" in data
    assert len(data["data"]) >= 1
    assert any(approval["id"] == approval_id for approval in data["data"])


@pytest.mark.asyncio
async def test_filter_approvals_by_type(async_client, test_db):
    """Test filtering approvals by type."""
    user_id = uuid4()

    # Create different types of approvals
    await async_client.post(
        "/api/approvals",
        json={
            "approval_type": "order",
            "entity_id": str(uuid4()),
            "entity_type": "order",
            "total_steps": 1,
            "requested_by": str(user_id),
        },
    )

    await async_client.post(
        "/api/approvals",
        json={
            "approval_type": "quote",
            "entity_id": str(uuid4()),
            "entity_type": "quote",
            "total_steps": 1,
            "requested_by": str(user_id),
        },
    )

    # Filter by order type
    response = await async_client.get("/api/approvals?approval_type=order")

    assert response.status_code == 200
    data = response.json()

    assert len(data["data"]) >= 1
    assert all(approval["approval_type"] == "order" for approval in data["data"])
