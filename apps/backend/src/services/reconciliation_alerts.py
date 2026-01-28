"""
Reconciliation Alert Service.

Monitors reconciliation discrepancies and sends notifications:
- Unmatched transactions exceeding threshold
- Large amount discrepancies
- Daily reconciliation reports
"""

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional
from uuid import UUID

import structlog
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.pos_models import BankAccount, BankFeed, POSTransaction

logger = structlog.get_logger(__name__)


class ReconciliationAlert:
    """Reconciliation alert data."""

    def __init__(
        self,
        alert_type: str,
        severity: str,
        title: str,
        description: str,
        affected_count: int = 0,
        total_amount: Decimal = Decimal("0"),
        details: Optional[dict] = None,
    ):
        self.alert_type = alert_type
        self.severity = severity  # info, warning, critical
        self.title = title
        self.description = description
        self.affected_count = affected_count
        self.total_amount = total_amount
        self.details = details or {}
        self.created_at = datetime.now()


class ReconciliationAlertsService:
    """Service for monitoring and alerting on reconciliation discrepancies."""

    # Alert thresholds
    UNMATCHED_THRESHOLD = 10  # Alert if > 10 unmatched transactions
    LARGE_AMOUNT_THRESHOLD = Decimal("1000.00")  # Alert if single transaction > $1000
    TOTAL_UNMATCHED_THRESHOLD = Decimal("5000.00")  # Alert if total unmatched > $5000
    DAYS_UNMATCHED_THRESHOLD = 7  # Alert if transaction unmatched for > 7 days

    def __init__(self, db: AsyncSession):
        self.db = db

    async def check_reconciliation_alerts(
        self,
        account_id: Optional[UUID] = None,
    ) -> list[ReconciliationAlert]:
        """
        Check for reconciliation issues and generate alerts.

        Args:
            account_id: Optional bank account ID to check (None = all accounts)

        Returns:
            List of active alerts
        """
        alerts = []

        # Check 1: Unmatched transaction count
        unmatched_alert = await self._check_unmatched_count(account_id)
        if unmatched_alert:
            alerts.append(unmatched_alert)

        # Check 2: Large unmatched amounts
        large_amounts_alert = await self._check_large_unmatched_amounts(account_id)
        if large_amounts_alert:
            alerts.append(large_amounts_alert)

        # Check 3: Old unmatched transactions
        old_transactions_alert = await self._check_old_unmatched_transactions(account_id)
        if old_transactions_alert:
            alerts.append(old_transactions_alert)

        # Check 4: Total unmatched amount threshold
        total_amount_alert = await self._check_total_unmatched_amount(account_id)
        if total_amount_alert:
            alerts.append(total_amount_alert)

        # Check 5: POS transactions without Xero invoices
        missing_invoices_alert = await self._check_missing_xero_invoices()
        if missing_invoices_alert:
            alerts.append(missing_invoices_alert)

        return alerts

    async def _check_unmatched_count(self, account_id: Optional[UUID]) -> Optional[ReconciliationAlert]:
        """Check if unmatched transaction count exceeds threshold."""
        query = select(func.count(BankFeed.id)).where(BankFeed.match_status == "pending")

        if account_id:
            query = query.where(BankFeed.bank_account_id == account_id)

        result = await self.db.execute(query)
        unmatched_count = result.scalar() or 0

        if unmatched_count >= self.UNMATCHED_THRESHOLD:
            return ReconciliationAlert(
                alert_type="unmatched_count",
                severity="warning" if unmatched_count < 50 else "critical",
                title=f"{unmatched_count} Unmatched Bank Transactions",
                description=f"There are {unmatched_count} unmatched bank feed transactions requiring manual review.",
                affected_count=unmatched_count,
            )

        return None

    async def _check_large_unmatched_amounts(self, account_id: Optional[UUID]) -> Optional[ReconciliationAlert]:
        """Check for individual large unmatched amounts."""
        query = (
            select(BankFeed)
            .where(
                and_(
                    BankFeed.match_status == "pending",
                    or_(
                        BankFeed.credit > self.LARGE_AMOUNT_THRESHOLD,
                        BankFeed.debit > self.LARGE_AMOUNT_THRESHOLD,
                    ),
                )
            )
        )

        if account_id:
            query = query.where(BankFeed.bank_account_id == account_id)

        result = await self.db.execute(query)
        large_transactions = result.scalars().all()

        if large_transactions:
            total = sum(
                (txn.credit or Decimal("0")) + (txn.debit or Decimal("0"))
                for txn in large_transactions
            )

            return ReconciliationAlert(
                alert_type="large_amounts",
                severity="critical",
                title=f"{len(large_transactions)} Large Unmatched Transactions",
                description=f"Large transactions (>${self.LARGE_AMOUNT_THRESHOLD}) need immediate reconciliation. Total: ${total:,.2f}",
                affected_count=len(large_transactions),
                total_amount=total,
                details={
                    "transactions": [
                        {
                            "id": str(txn.id),
                            "date": txn.transaction_date.isoformat(),
                            "amount": float(txn.credit or txn.debit or 0),
                            "description": txn.description[:50],
                        }
                        for txn in large_transactions[:10]  # Show first 10
                    ]
                },
            )

        return None

    async def _check_old_unmatched_transactions(self, account_id: Optional[UUID]) -> Optional[ReconciliationAlert]:
        """Check for transactions unmatched for extended period."""
        cutoff_date = date.today() - timedelta(days=self.DAYS_UNMATCHED_THRESHOLD)

        query = (
            select(BankFeed)
            .where(
                and_(
                    BankFeed.match_status == "pending",
                    BankFeed.transaction_date < cutoff_date,
                )
            )
        )

        if account_id:
            query = query.where(BankFeed.bank_account_id == account_id)

        result = await self.db.execute(query)
        old_transactions = result.scalars().all()

        if old_transactions:
            return ReconciliationAlert(
                alert_type="old_unmatched",
                severity="warning",
                title=f"{len(old_transactions)} Old Unmatched Transactions",
                description=f"Transactions older than {self.DAYS_UNMATCHED_THRESHOLD} days remain unmatched. These need urgent attention.",
                affected_count=len(old_transactions),
                details={
                    "oldest_date": min(txn.transaction_date for txn.transaction_date in [txn.transaction_date for txn in old_transactions]).isoformat(),
                    "age_days": (date.today() - min(txn.transaction_date for txn in old_transactions)).days,
                },
            )

        return None

    async def _check_total_unmatched_amount(self, account_id: Optional[UUID]) -> Optional[ReconciliationAlert]:
        """Check if total unmatched amount exceeds threshold."""
        query = (
            select(
                func.sum(func.coalesce(BankFeed.credit, 0) + func.coalesce(BankFeed.debit, 0))
            )
            .where(BankFeed.match_status == "pending")
        )

        if account_id:
            query = query.where(BankFeed.bank_account_id == account_id)

        result = await self.db.execute(query)
        total_unmatched = result.scalar() or Decimal("0")

        if total_unmatched >= self.TOTAL_UNMATCHED_THRESHOLD:
            return ReconciliationAlert(
                alert_type="total_amount",
                severity="critical",
                title=f"${total_unmatched:,.2f} in Unmatched Transactions",
                description=f"Total value of unmatched transactions (${total_unmatched:,.2f}) exceeds threshold (${self.TOTAL_UNMATCHED_THRESHOLD:,.2f}).",
                total_amount=total_unmatched,
            )

        return None

    async def _check_missing_xero_invoices(self) -> Optional[ReconciliationAlert]:
        """Check for captured POS transactions without Xero invoices."""
        query = (
            select(func.count(POSTransaction.id))
            .where(
                and_(
                    POSTransaction.payment_status == "captured",
                    POSTransaction.xero_invoice_id.is_(None),
                )
            )
        )

        result = await self.db.execute(query)
        missing_count = result.scalar() or 0

        if missing_count > 0:
            # Get total amount
            amount_query = (
                select(func.sum(POSTransaction.amount))
                .where(
                    and_(
                        POSTransaction.payment_status == "captured",
                        POSTransaction.xero_invoice_id.is_(None),
                    )
                )
            )
            amount_result = await self.db.execute(amount_query)
            total_amount = amount_result.scalar() or Decimal("0")

            return ReconciliationAlert(
                alert_type="missing_xero_invoices",
                severity="warning" if missing_count < 10 else "critical",
                title=f"{missing_count} POS Transactions Not in Xero",
                description=f"{missing_count} captured POS transactions (${total_amount:,.2f}) have not been synced to Xero. Run bulk invoice creation to sync.",
                affected_count=missing_count,
                total_amount=total_amount,
            )

        return None

    async def get_daily_reconciliation_summary(
        self,
        report_date: Optional[date] = None,
    ) -> dict:
        """
        Generate daily reconciliation summary report.

        Args:
            report_date: Date for report (defaults to today)

        Returns:
            Dictionary with reconciliation metrics
        """
        if not report_date:
            report_date = date.today()

        # Get all alerts
        alerts = await self.check_reconciliation_alerts()

        # Get reconciliation stats for the day
        pos_query = (
            select(
                func.count(POSTransaction.id).label("total"),
                func.count(POSTransaction.id).filter(POSTransaction.payment_status == "captured").label("captured"),
                func.count(POSTransaction.id).filter(POSTransaction.reconciliation_status == "matched").label("matched"),
                func.sum(POSTransaction.amount).label("total_amount"),
            )
            .where(func.date(POSTransaction.created_at) == report_date)
        )

        pos_result = await self.db.execute(pos_query)
        pos_stats = pos_result.one()

        # Get bank feed stats
        bank_query = (
            select(
                func.count(BankFeed.id).label("total"),
                func.count(BankFeed.id).filter(BankFeed.match_status == "auto_matched").label("auto_matched"),
                func.count(BankFeed.id).filter(BankFeed.match_status == "manual_matched").label("manual_matched"),
                func.count(BankFeed.id).filter(BankFeed.match_status == "pending").label("unmatched"),
            )
            .where(BankFeed.transaction_date == report_date)
        )

        bank_result = await self.db.execute(bank_query)
        bank_stats = bank_result.one()

        return {
            "report_date": report_date.isoformat(),
            "pos_transactions": {
                "total": pos_stats.total or 0,
                "captured": pos_stats.captured or 0,
                "matched": pos_stats.matched or 0,
                "total_amount": float(pos_stats.total_amount or 0),
            },
            "bank_feeds": {
                "total": bank_stats.total or 0,
                "auto_matched": bank_stats.auto_matched or 0,
                "manual_matched": bank_stats.manual_matched or 0,
                "unmatched": bank_stats.unmatched or 0,
            },
            "alerts": [
                {
                    "type": alert.alert_type,
                    "severity": alert.severity,
                    "title": alert.title,
                    "description": alert.description,
                    "affected_count": alert.affected_count,
                    "total_amount": float(alert.total_amount),
                }
                for alert in alerts
            ],
            "health_status": "critical" if any(a.severity == "critical" for a in alerts)
                           else "warning" if any(a.severity == "warning" for a in alerts)
                           else "healthy",
        }
