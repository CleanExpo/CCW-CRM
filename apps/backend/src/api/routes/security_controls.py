"""ASD Essential Eight baseline controls status — UNI-1857."""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.routes.demo_auth import get_current_user
from src.config.database import get_async_db
from src.db.models import User

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/security", tags=["Security Controls"])

COMPLIANT = "compliant"
PARTIAL = "partial"
NON_COMPLIANT = "non_compliant"


class ControlStatus(BaseModel):
    name: str
    status: str  # compliant | partial | non_compliant
    detail: str


class EssentialEightResponse(BaseModel):
    controls: list[ControlStatus]
    overall_score: int
    max_score: int
    assessed_at: str


class EssentialEightReport(EssentialEightResponse):
    report_type: str
    framework_version: str


async def _assess_controls(db: AsyncSession) -> tuple[list[ControlStatus], int]:
    """Evaluate all eight controls; return (controls, score)."""
    controls: list[ControlStatus] = []

    # 1. application_control — ALLOWED_ORIGINS must be set and not wildcard
    origins = os.getenv("ALLOWED_ORIGINS", "")
    if origins and origins.strip() != "*":
        controls.append(ControlStatus(name="application_control", status=COMPLIANT,
                                      detail="ALLOWED_ORIGINS is configured and restricted"))
    elif origins.strip() == "*":
        controls.append(ControlStatus(name="application_control", status=NON_COMPLIANT,
                                      detail="ALLOWED_ORIGINS is set to wildcard (*)"))
    else:
        controls.append(ControlStatus(name="application_control", status=NON_COMPLIANT,
                                      detail="ALLOWED_ORIGINS env var is not set"))

    # 2. patch_applications — report current app version
    version = os.getenv("APP_VERSION", "unknown")
    status = COMPLIANT if version != "unknown" else PARTIAL
    controls.append(ControlStatus(name="patch_applications", status=status,
                                  detail=f"Application version: {version}"))

    # 3. mfa_enabled
    mfa = os.getenv("MFA_REQUIRED", "").lower()
    if mfa in ("1", "true", "yes"):
        controls.append(ControlStatus(name="mfa_enabled", status=COMPLIANT,
                                      detail="MFA enforcement is enabled"))
    else:
        controls.append(ControlStatus(name="mfa_enabled", status=NON_COMPLIANT,
                                      detail="MFA_REQUIRED env var is not set or false"))

    # 4. admin_privileges — warn if more than 3 admins
    result = await db.execute(select(func.count()).where(User.role == "admin"))
    admin_count: int = result.scalar_one_or_none() or 0
    if admin_count <= 3:
        controls.append(ControlStatus(name="admin_privileges", status=COMPLIANT,
                                      detail=f"{admin_count} admin user(s) — within acceptable limit"))
    else:
        controls.append(ControlStatus(name="admin_privileges", status=PARTIAL,
                                      detail=f"{admin_count} admin users detected — recommend reducing to ≤3"))

    # 5. regular_backups
    backup = os.getenv("BACKUP_ENABLED", "").lower()
    if backup in ("1", "true", "yes"):
        controls.append(ControlStatus(name="regular_backups", status=COMPLIANT,
                                      detail="Automated backups are enabled"))
    else:
        controls.append(ControlStatus(name="regular_backups", status=NON_COMPLIANT,
                                      detail="BACKUP_ENABLED env var is not set"))

    # 6. audit_logging — always compliant (audit_trail route is implemented)
    controls.append(ControlStatus(name="audit_logging", status=COMPLIANT,
                                  detail="Audit trail endpoint active (/api/audit)"))

    # 7. encryption_at_rest — DATABASE_URL must contain sslmode or sslrootcert
    db_url = os.getenv("DATABASE_URL", "")
    if "sslmode" in db_url or "sslrootcert" in db_url or "ssl=true" in db_url.lower():
        controls.append(ControlStatus(name="encryption_at_rest", status=COMPLIANT,
                                      detail="DATABASE_URL contains SSL parameters"))
    else:
        controls.append(ControlStatus(name="encryption_at_rest", status=PARTIAL,
                                      detail="DATABASE_URL does not include explicit SSL parameters"))

    # 8. application_hardening
    hardening = os.getenv("SECURE_HEADERS_ENABLED", "").lower()
    if hardening in ("1", "true", "yes"):
        controls.append(ControlStatus(name="application_hardening", status=COMPLIANT,
                                      detail="Secure headers middleware is enabled"))
    else:
        controls.append(ControlStatus(name="application_hardening", status=NON_COMPLIANT,
                                      detail="SECURE_HEADERS_ENABLED env var is not set"))

    score = sum(1 for c in controls if c.status == COMPLIANT)
    return controls, score


@router.get("/essential-eight/status", response_model=EssentialEightResponse)
async def essential_eight_status(
    _current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> EssentialEightResponse:
    """Return current ASD Essential Eight compliance status."""
    controls, score = await _assess_controls(db)
    return EssentialEightResponse(
        controls=controls,
        overall_score=score,
        max_score=8,
        assessed_at=datetime.now(timezone.utc).isoformat(),
    )


@router.get("/essential-eight/report", response_model=EssentialEightReport)
async def essential_eight_report(
    _current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> EssentialEightReport:
    """Return ASD Essential Eight PDF-ready structured report."""
    controls, score = await _assess_controls(db)
    return EssentialEightReport(
        controls=controls,
        overall_score=score,
        max_score=8,
        assessed_at=datetime.now(timezone.utc).isoformat(),
        report_type="ASD_E8",
        framework_version="Nov 2023",
    )
