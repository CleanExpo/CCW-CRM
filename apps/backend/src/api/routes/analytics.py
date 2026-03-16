"""Analytics metrics API endpoints.

Provides agent performance metrics, token usage, and cost tracking
for the dashboard-analytics page.
"""

import json
from datetime import UTC, datetime, timedelta
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.db.demo_models import AIGeneratedContent

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

# Map time_range strings to timedelta
TIME_RANGE_MAP = {
    "1h": timedelta(hours=1),
    "6h": timedelta(hours=6),
    "24h": timedelta(days=1),
    "7d": timedelta(days=7),
    "30d": timedelta(days=30),
    "90d": timedelta(days=90),
}


@router.get("/metrics/overview")
async def get_metrics_overview(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    time_range: str = Query("7d", description="Time range: 1h, 6h, 24h, 7d, 30d, 90d"),
) -> dict:
    """Return agent run metrics for the analytics dashboard.

    Aggregates from AIGeneratedContent table which tracks all AI agent executions.
    Each row represents one AI generation run (quote, email, summary, etc.).
    """
    delta = TIME_RANGE_MAP.get(time_range, timedelta(days=7))
    since = datetime.now(UTC) - delta

    # Count total AI content generated within time range
    count_stmt = (
        select(func.count(AIGeneratedContent.id))
        .where(AIGeneratedContent.created_at >= since)
    )
    total_result = await db.execute(count_stmt)
    total_runs = total_result.scalar() or 0

    # Count by content_type for breakdown
    type_stmt = (
        select(AIGeneratedContent.content_type, func.count(AIGeneratedContent.id))
        .where(AIGeneratedContent.created_at >= since)
        .group_by(AIGeneratedContent.content_type)
    )
    type_result = await db.execute(type_stmt)
    type_counts = {row[0]: row[1] for row in type_result.all()}

    # Parse content_metadata for token/cost info from recent rows
    meta_stmt = (
        select(AIGeneratedContent.content_metadata)
        .where(AIGeneratedContent.created_at >= since)
        .where(AIGeneratedContent.content_metadata.isnot(None))
    )
    meta_result = await db.execute(meta_stmt)
    meta_rows = meta_result.scalars().all()

    total_input_tokens = 0
    total_output_tokens = 0
    total_cost_usd = 0.0
    durations: list[float] = []

    for raw_meta in meta_rows:
        try:
            meta = json.loads(raw_meta) if isinstance(raw_meta, str) else {}
        except (json.JSONDecodeError, TypeError):
            meta = {}
        total_input_tokens += meta.get("input_tokens", 0)
        total_output_tokens += meta.get("output_tokens", 0)
        total_cost_usd += meta.get("cost_usd", 0.0)
        if meta.get("duration_seconds"):
            durations.append(float(meta["duration_seconds"]))

    avg_duration = round(sum(durations) / len(durations), 1) if durations else 0.0

    # All rows in this table represent completed generations (no status field)
    # Treat all as completed since they only exist after successful generation
    completed_runs = total_runs
    failed_runs = 0
    active_runs = 0
    success_rate = 100.0 if total_runs > 0 else 0.0

    return {
        "total_runs": total_runs,
        "completed_runs": completed_runs,
        "failed_runs": failed_runs,
        "active_runs": active_runs,
        "success_rate": success_rate,
        "avg_duration_seconds": avg_duration,
        "total_cost_usd": round(total_cost_usd, 4),
        "total_input_tokens": total_input_tokens,
        "total_output_tokens": total_output_tokens,
        "time_range": time_range,
        "by_type": type_counts,
    }
