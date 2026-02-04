"""
Bank Feed Scheduler.

Handles automated synchronization of bank feeds on a daily schedule.
"""

import asyncio
from datetime import date, timedelta
from uuid import UUID

import structlog
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.db.pos_models import BankAccount
from src.services.bank_feed_service import BankFeedService

logger = structlog.get_logger(__name__)


class BankFeedScheduler:
    """Scheduler for automated bank feed synchronization."""

    def __init__(self, session_maker: async_sessionmaker[AsyncSession]):
        """Initialize scheduler.

        Args:
            session_maker: SQLAlchemy async session factory
        """
        self.session_maker = session_maker
        self.scheduler = AsyncIOScheduler()

        # Register jobs
        self._register_jobs()

    def _register_jobs(self) -> None:
        """Register scheduled jobs."""
        # Daily bank feed sync at 9:00 AM
        self.scheduler.add_job(
            self.sync_all_bank_feeds,
            trigger=CronTrigger(hour=9, minute=0),
            id="bank_feed_sync",
            name="Daily Bank Feed Sync",
            replace_existing=True,
            max_instances=1,  # Prevent overlapping executions
        )

        logger.info(
            "Registered bank feed sync job",
            schedule="Daily at 9:00 AM",
        )

    async def sync_all_bank_feeds(self) -> None:
        """Sync bank feeds for all active accounts.

        This job:
        1. Fetches bank transactions from last 7 days (configurable)
        2. Auto-reconciles with POS transactions
        3. Sends summary email to accounts team
        """
        logger.info("Starting scheduled bank feed sync")

        async with self.session_maker() as db:
            try:
                # Get all active bank accounts with feed providers
                result = await db.execute(
                    select(BankAccount).where(
                        BankAccount.is_active == True,  # noqa: E712
                        BankAccount.feed_provider.isnot(None),
                        BankAccount.feed_provider != "manual",
                    )
                )
                accounts = result.scalars().all()

                if not accounts:
                    logger.warning("No active bank accounts with feed providers found")
                    return

                logger.info(
                    "Found active bank accounts",
                    count=len(accounts),
                )

                # Sync each account
                total_transactions = 0
                total_auto_matched = 0
                account_results = []

                # Sync last 7 days
                end_date = date.today()
                start_date = end_date - timedelta(days=7)

                for account in accounts:
                    try:
                        logger.info(
                            "Syncing bank feed",
                            account_id=str(account.id),
                            account_name=account.account_name,
                            provider=account.feed_provider,
                        )

                        service = BankFeedService(db)

                        # Sync transactions
                        sync_result = await service.sync_bank_feeds(
                            account_id=account.id,
                            start_date=start_date,
                            end_date=end_date,
                        )

                        transactions_synced = sync_result["transactions_synced"]
                        total_transactions += transactions_synced

                        # Auto-reconcile was already done in sync_bank_feeds
                        # Get reconciliation stats
                        recon_result = await service.auto_reconcile(account.id)
                        auto_matched = recon_result["auto_matched"]
                        total_auto_matched += auto_matched

                        account_results.append({
                            "account_name": account.account_name,
                            "provider": account.feed_provider,
                            "transactions_synced": transactions_synced,
                            "auto_matched": auto_matched,
                        })

                        logger.info(
                            "Bank feed sync completed",
                            account_id=str(account.id),
                            transactions=transactions_synced,
                            auto_matched=auto_matched,
                        )

                    except Exception as e:
                        logger.error(
                            "Failed to sync bank feed",
                            account_id=str(account.id),
                            account_name=account.account_name,
                            error=str(e),
                        )
                        account_results.append({
                            "account_name": account.account_name,
                            "provider": account.feed_provider,
                            "error": str(e),
                        })

                # Send summary email
                try:
                    from src.services.email_service import EmailService

                    email_service = EmailService()
                    await email_service.send_bank_feed_sync_summary(
                        date_range=(start_date, end_date),
                        total_transactions=total_transactions,
                        total_auto_matched=total_auto_matched,
                        account_results=account_results,
                    )

                    logger.info(
                        "Sent bank feed sync summary email",
                        total_transactions=total_transactions,
                        total_auto_matched=total_auto_matched,
                    )

                except Exception as e:
                    logger.error(
                        "Failed to send summary email",
                        error=str(e),
                    )

                logger.info(
                    "Scheduled bank feed sync completed",
                    accounts_synced=len(accounts),
                    total_transactions=total_transactions,
                    total_auto_matched=total_auto_matched,
                )

            except Exception as e:
                logger.error(
                    "Bank feed sync job failed",
                    error=str(e),
                )
                raise

    def start(self) -> None:
        """Start the scheduler."""
        self.scheduler.start()
        logger.info("Bank feed scheduler started")

    def shutdown(self, wait: bool = True) -> None:
        """Shutdown the scheduler.

        Args:
            wait: Whether to wait for running jobs to complete
        """
        self.scheduler.shutdown(wait=wait)
        logger.info("Bank feed scheduler shutdown")

    async def trigger_manual_sync(self, account_id: UUID | None = None) -> dict:
        """Manually trigger bank feed sync (used by API endpoint).

        Args:
            account_id: Sync specific account, or None for all accounts

        Returns:
            Sync result summary
        """
        logger.info(
            "Manual bank feed sync triggered",
            account_id=str(account_id) if account_id else "all",
        )

        async with self.session_maker() as db:
            service = BankFeedService(db)

            # Sync last 7 days
            end_date = date.today()
            start_date = end_date - timedelta(days=7)

            if account_id:
                # Sync specific account
                sync_result = await service.sync_bank_feeds(
                    account_id=account_id,
                    start_date=start_date,
                    end_date=end_date,
                )
                return sync_result
            else:
                # Sync all accounts
                await self.sync_all_bank_feeds()
                return {"status": "completed", "message": "All accounts synced"}
