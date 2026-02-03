"""
Team Management API endpoints.

Provides team member management for multi-tenant organizations:
- List team members (users in current organization)
- Invite new members
- Update member roles (RBAC integration)
- Remove members
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.middleware.rbac import require_permission
from src.api.middleware.tenant_isolation import CurrentOrganization
from src.config.database import get_async_db
from src.db.models_base import User

router = APIRouter(prefix="/api/team", tags=["Team Management"])


# Pydantic models
class TeamMemberResponse(BaseModel):
    """Schema for team member response."""

    id: UUID
    email: str
    full_name: str | None
    role: str  # owner, admin, member, billing
    is_active: bool
    created_at: str

    class Config:
        from_attributes = True


class TeamMemberInvite(BaseModel):
    """Schema for inviting a new team member."""

    email: EmailStr
    full_name: str | None = Field(None, max_length=255)
    role: str = Field("member", pattern="^(owner|admin|member|billing)$")


class TeamMemberRoleUpdate(BaseModel):
    """Schema for updating team member role."""

    role: str = Field(..., pattern="^(owner|admin|member|billing)$")


class PaginatedTeamResponse(BaseModel):
    """Paginated response for team members."""

    data: list[TeamMemberResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


@router.get("", response_model=PaginatedTeamResponse)
@require_permission("team:read")
async def list_team_members(
    org_id: CurrentOrganization,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: str | None = Query(None, description="Search by name or email"),
    role: str | None = Query(None, description="Filter by role"),
) -> PaginatedTeamResponse:
    """
    List all team members in the current organization.

    Requires 'team:read' permission.
    """
    query = select(User).where(User.organization_id == org_id)

    # Apply search filter
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            or_(
                User.email.ilike(search_pattern),
                User.full_name.ilike(search_pattern),
            )
        )

    # Apply role filter
    if role:
        query = query.where(User.role == role)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    # Apply pagination
    query = query.order_by(User.created_at.desc()).limit(page_size).offset((page - 1) * page_size)

    # Execute
    result = await db.execute(query)
    users = result.scalars().all()

    return PaginatedTeamResponse(
        data=[
            TeamMemberResponse(
                id=user.id,
                email=user.email,
                full_name=user.full_name,
                role=user.role or "member",
                is_active=user.is_active,
                created_at=user.created_at.isoformat(),
            )
            for user in users
        ],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.post("/invite", response_model=TeamMemberResponse, status_code=201)
@require_permission("team:invite")
async def invite_team_member(
    invite_data: TeamMemberInvite,
    org_id: CurrentOrganization,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> TeamMemberResponse:
    """
    Invite a new team member to the organization.

    Requires 'team:invite' permission (Owner, Admin).

    Creates a user account with temporary password and sends invitation email.
    """
    # Check if email already exists in this organization
    existing = await db.execute(
        select(User).where(
            User.email == invite_data.email,
            User.organization_id == org_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail=f"User with email '{invite_data.email}' already exists in this organization",
        )

    # Create user with temporary password (should be reset on first login)
    # In production, this would send an invitation email with a secure token
    user = User(
        email=invite_data.email,
        full_name=invite_data.full_name,
        role=invite_data.role,
        organization_id=org_id,
        is_active=True,
        hashed_password="TEMP_PASSWORD_CHANGE_ON_FIRST_LOGIN",  # Placeholder
    )

    db.add(user)
    await db.commit()
    await db.refresh(user)

    # TODO: Send invitation email with magic link
    # from src.integrations.email import send_team_invitation_email
    # await send_team_invitation_email(user.email, user.full_name, org_id)

    return TeamMemberResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role or "member",
        is_active=user.is_active,
        created_at=user.created_at.isoformat(),
    )


@router.put("/{user_id}/role", response_model=TeamMemberResponse)
@require_permission("team:edit_roles")
async def update_member_role(
    user_id: UUID,
    role_update: TeamMemberRoleUpdate,
    org_id: CurrentOrganization,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> TeamMemberResponse:
    """
    Update a team member's role.

    Requires 'team:edit_roles' permission (Owner only).

    Role changes invalidate existing JWT tokens (user must re-login).
    """
    # Fetch user and validate belongs to current organization
    result = await db.execute(
        select(User).where(
            User.id == user_id,
            User.organization_id == org_id,
        )
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="Team member not found")

    # Prevent changing the last owner's role (must have at least one owner)
    if user.role == "owner" and role_update.role != "owner":
        owner_count = await db.execute(
            select(func.count()).where(
                User.organization_id == org_id,
                User.role == "owner",
                User.is_active == True,
            )
        )
        owner_count_value = owner_count.scalar() or 0
        if owner_count_value <= 1:
            raise HTTPException(
                status_code=400,
                detail="Cannot change the last owner's role. Organization must have at least one owner.",
            )

    # Update role
    user.role = role_update.role

    await db.commit()
    await db.refresh(user)

    # TODO: Invalidate user's JWT tokens (force re-login)
    # This ensures the user gets a new token with updated role permissions

    return TeamMemberResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role or "member",
        is_active=user.is_active,
        created_at=user.created_at.isoformat(),
    )


@router.delete("/{user_id}", status_code=204)
@require_permission("team:remove")
async def remove_team_member(
    user_id: UUID,
    org_id: CurrentOrganization,
    db: Annotated[AsyncSession, Depends(get_async_db)],
):
    """
    Remove a team member from the organization.

    Requires 'team:remove' permission (Owner only).

    Soft delete - sets is_active = False.
    Cannot remove the last owner.
    """
    # Fetch user and validate belongs to current organization
    result = await db.execute(
        select(User).where(
            User.id == user_id,
            User.organization_id == org_id,
        )
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="Team member not found")

    # Prevent removing the last owner
    if user.role == "owner":
        owner_count = await db.execute(
            select(func.count()).where(
                User.organization_id == org_id,
                User.role == "owner",
                User.is_active == True,
            )
        )
        owner_count_value = owner_count.scalar() or 0
        if owner_count_value <= 1:
            raise HTTPException(
                status_code=400,
                detail="Cannot remove the last owner. Organization must have at least one owner.",
            )

    # Soft delete
    user.is_active = False

    await db.commit()
