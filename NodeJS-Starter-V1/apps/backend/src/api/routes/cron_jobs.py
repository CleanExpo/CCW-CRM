"""
Cron job endpoints for scheduled tasks.

These endpoints are called by Vercel Cron or other schedulers.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.services.notification_service import get_notification_service

router = APIRouter(prefix="/api/cron", tags=["Cron Jobs"])


def verify_cron_secret(authorization: str | None = Header(None)) -> bool:
    """
    Verify cron job authorization.

    In production, Vercel cron jobs send an Authorization header.
    For development, we allow all requests.
    """
    import os

    cron_secret = os.getenv("CRON_SECRET")
    if not cron_secret:
        # Development mode - allow all
        return True

    if not authorization:
        return False

    # Check if authorization header matches secret
    return authorization == f"Bearer {cron_secret}"


@router.post("/check-expiring-quotes")
async def check_expiring_quotes(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    authorization: str | None = Header(None),
) -> dict:
    """
    Check for quotes expiring in 3 days and send notifications.

    This endpoint should be called by Vercel Cron daily at 9 AM:

    vercel.json:
    ```json
    {
      "crons": [
        {
          "path": "/api/cron/check-expiring-quotes",
          "schedule": "0 9 * * *"
        }
      ]
    }
    ```

    Returns:
        Status and count of notifications sent
    """
    if not verify_cron_secret(authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

    notification_service = get_notification_service()
    count = await notification_service.check_expiring_quotes(db)

    return {
        "status": "success",
        "message": f"Checked expiring quotes and sent {count} notifications",
        "notifications_sent": count,
    }
