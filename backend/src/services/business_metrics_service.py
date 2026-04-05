"""Business metrics collection service for monitoring dashboard."""

from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.demo_models import Order, OrderStatus

logger = structlog.get_logger(__name__)


class BusinessMetricsService:
    """Service for collecting business metrics."""

    def __init__(self) -> None:
        """Initialize the business metrics service."""
        pass

    async def get_pos_metrics(self, db: AsyncSession) -> dict[str, Any]:
        """
        Get POS transaction metrics.

        Args:
            db: Database session

        Returns:
            POS metrics including volume, failures, average transaction value
        """
        try:
            # Import POS models
            try:
                from src.db.pos_models import POSTransaction

                now = datetime.now(UTC)
                today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
                week_start = today_start - timedelta(days=today_start.weekday())
                month_start = today_start.replace(day=1)

                # Today's transactions
                today_result = await db.execute(
                    select(
                        func.count(POSTransaction.id).label("count"),
                        func.sum(POSTransaction.amount).label("total"),
                        func.avg(POSTransaction.amount).label("average"),
                    ).where(POSTransaction.created_at >= today_start)
                )
                today_stats = today_result.first()

                # This week's transactions
                week_result = await db.execute(
                    select(
                        func.count(POSTransaction.id).label("count"),
                        func.sum(POSTransaction.amount).label("total"),
                    ).where(POSTransaction.created_at >= week_start)
                )
                week_stats = week_result.first()

                # This month's transactions
                month_result = await db.execute(
                    select(
                        func.count(POSTransaction.id).label("count"),
                        func.sum(POSTransaction.amount).label("total"),
                    ).where(POSTransaction.created_at >= month_start)
                )
                month_stats = month_result.first()

                # Payment failures (last 24 hours)
                failures_result = await db.execute(
                    select(func.count(POSTransaction.id)).where(
                        POSTransaction.created_at >= now - timedelta(hours=24),
                        POSTransaction.status == "failed",
                    )
                )
                failures_count = failures_result.scalar() or 0

                # Total transactions (last 24 hours) for failure rate
                total_24h_result = await db.execute(
                    select(func.count(POSTransaction.id)).where(
                        POSTransaction.created_at >= now - timedelta(hours=24)
                    )
                )
                total_24h = total_24h_result.scalar() or 0

                failure_rate = (failures_count / total_24h * 100) if total_24h > 0 else 0.0

                return {
                    "today": {
                        "transaction_count": today_stats.count or 0 if today_stats else 0,
                        "total_volume": float(today_stats.total or 0) if today_stats else 0.0,
                        "average_value": float(today_stats.average or 0) if today_stats else 0.0,
                    },
                    "this_week": {
                        "transaction_count": week_stats.count or 0 if week_stats else 0,
                        "total_volume": float(week_stats.total or 0) if week_stats else 0.0,
                    },
                    "this_month": {
                        "transaction_count": month_stats.count or 0 if month_stats else 0,
                        "total_volume": float(month_stats.total or 0) if month_stats else 0.0,
                    },
                    "payment_failures_24h": failures_count,
                    "failure_rate_percent": round(failure_rate, 2),
                }

            except ImportError:
                logger.warning("POS models not available, returning empty metrics")
                return {
                    "today": {"transaction_count": 0, "total_volume": 0.0, "average_value": 0.0},
                    "this_week": {"transaction_count": 0, "total_volume": 0.0},
                    "this_month": {"transaction_count": 0, "total_volume": 0.0},
                    "payment_failures_24h": 0,
                    "failure_rate_percent": 0.0,
                }

        except Exception as e:
            logger.error("Failed to get POS metrics", error=str(e))
            return {
                "today": {"transaction_count": 0, "total_volume": 0.0, "average_value": 0.0},
                "this_week": {"transaction_count": 0, "total_volume": 0.0},
                "this_month": {"transaction_count": 0, "total_volume": 0.0},
                "payment_failures_24h": 0,
                "failure_rate_percent": 0.0,
                "error": str(e),
            }

    async def get_reconciliation_metrics(self, db: AsyncSession) -> dict[str, Any]:
        """
        Get bank reconciliation metrics.

        Args:
            db: Database session

        Returns:
            Reconciliation metrics including success rate, unreconciled count
        """
        try:
            # Import reconciliation models
            try:
                from src.db.pos_models import BankFeed

                now = datetime.now(UTC)
                week_start = now - timedelta(days=7)

                # Total bank feeds (last 7 days)
                total_result = await db.execute(
                    select(func.count(BankFeed.id)).where(BankFeed.created_at >= week_start)
                )
                total_feeds = total_result.scalar() or 0

                # Reconciled bank feeds
                reconciled_result = await db.execute(
                    select(func.count(BankFeed.id)).where(
                        BankFeed.created_at >= week_start, BankFeed.reconciled == True  # noqa: E712
                    )
                )
                reconciled_feeds = reconciled_result.scalar() or 0

                # Unreconciled transactions
                unreconciled_result = await db.execute(
                    select(func.count(BankFeed.id)).where(BankFeed.reconciled == False)  # noqa: E712
                )
                unreconciled_count = unreconciled_result.scalar() or 0

                # Success rate
                success_rate = (reconciled_feeds / total_feeds * 100) if total_feeds > 0 else 0.0

                return {
                    "total_feeds_7d": total_feeds,
                    "reconciled_7d": reconciled_feeds,
                    "unreconciled_total": unreconciled_count,
                    "success_rate_percent": round(success_rate, 2),
                }

            except ImportError:
                logger.warning("Reconciliation models not available, returning empty metrics")
                return {
                    "total_feeds_7d": 0,
                    "reconciled_7d": 0,
                    "unreconciled_total": 0,
                    "success_rate_percent": 0.0,
                }

        except Exception as e:
            logger.error("Failed to get reconciliation metrics", error=str(e))
            return {
                "total_feeds_7d": 0,
                "reconciled_7d": 0,
                "unreconciled_total": 0,
                "success_rate_percent": 0.0,
                "error": str(e),
            }

    async def get_order_metrics(self, db: AsyncSession) -> dict[str, Any]:
        """
        Get order metrics.

        Args:
            db: Database session

        Returns:
            Order metrics including count by status, throughput, average value
        """
        try:
            now = datetime.now(UTC)
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            week_start = today_start - timedelta(days=today_start.weekday())

            # Orders by status
            status_result = await db.execute(
                select(
                    Order.status, func.count(Order.id).label("count")
                ).group_by(Order.status)
            )
            status_counts = {row.status: row.count for row in status_result}

            # Today's orders (throughput)
            today_result = await db.execute(
                select(func.count(Order.id)).where(Order.created_at >= today_start)
            )
            today_count = today_result.scalar() or 0

            # This week's orders
            week_result = await db.execute(
                select(
                    func.count(Order.id).label("count"),
                    func.sum(Order.total).label("total"),
                    func.avg(Order.total).label("average"),
                ).where(Order.created_at >= week_start)
            )
            week_stats = week_result.first()

            # Orders per hour (last 24 hours)
            hours_24_ago = now - timedelta(hours=24)
            hourly_result = await db.execute(
                select(func.count(Order.id)).where(Order.created_at >= hours_24_ago)
            )
            orders_24h = hourly_result.scalar() or 0
            orders_per_hour = round(orders_24h / 24, 2)

            return {
                "by_status": {
                    "draft": status_counts.get(OrderStatus.DRAFT, 0),
                    "pending": status_counts.get(OrderStatus.PENDING, 0),
                    "confirmed": status_counts.get(OrderStatus.CONFIRMED, 0),
                    "processing": status_counts.get(OrderStatus.PROCESSING, 0),
                    "shipped": status_counts.get(OrderStatus.SHIPPED, 0),
                    "delivered": status_counts.get(OrderStatus.DELIVERED, 0),
                    "cancelled": status_counts.get(OrderStatus.CANCELLED, 0),
                },
                "today_count": today_count,
                "this_week": {
                    "count": week_stats.count or 0 if week_stats else 0,
                    "total_value": float(week_stats.total or 0) if week_stats else 0.0,
                    "average_value": float(week_stats.average or 0) if week_stats else 0.0,
                },
                "orders_per_hour_24h": orders_per_hour,
            }

        except Exception as e:
            logger.error("Failed to get order metrics", error=str(e))
            return {
                "by_status": {
                    "draft": 0,
                    "pending": 0,
                    "confirmed": 0,
                    "processing": 0,
                    "shipped": 0,
                    "delivered": 0,
                    "cancelled": 0,
                },
                "today_count": 0,
                "this_week": {"count": 0, "total_value": 0.0, "average_value": 0.0},
                "orders_per_hour_24h": 0.0,
                "error": str(e),
            }

    async def get_all_business_metrics(self, db: AsyncSession) -> dict[str, Any]:
        """
        Get all business metrics in one call.

        Args:
            db: Database session

        Returns:
            Combined metrics for POS, reconciliation, and orders
        """
        pos_metrics = await self.get_pos_metrics(db)
        reconciliation_metrics = await self.get_reconciliation_metrics(db)
        order_metrics = await self.get_order_metrics(db)

        return {
            "pos": pos_metrics,
            "reconciliation": reconciliation_metrics,
            "orders": order_metrics,
            "timestamp": datetime.now(UTC).isoformat(),
        }


# Global business metrics service instance
_business_metrics_service: BusinessMetricsService | None = None


def get_business_metrics_service() -> BusinessMetricsService:
    """
    Get the global business metrics service instance.

    Returns:
        The global BusinessMetricsService instance
    """
    global _business_metrics_service
    if _business_metrics_service is None:
        _business_metrics_service = BusinessMetricsService()
        logger.info("Business metrics service initialized")
    return _business_metrics_service
