# POS Bank Feed Auto-Sync - Implementation Plan

**Priority**: P1-1 (High Priority)
**Effort**: 5 points (1-2 days)
**Status**: 🟡 READY - No blockers
**Objective**: Automate daily bank feed sync and reconciliation to achieve 90%+ auto-match rate

---

## Business Context

### Current State

**Manual Process**:
- Accounts team manually pulls bank feed from Xero
- Manually matches POS transactions to bank entries
- 10+ hours/week spent on reconciliation
- Error-prone (manual data entry)
- Delayed reconciliation (done weekly/monthly)

**What Exists**:
- ✅ POS transaction capture (frontend + backend)
- ✅ POS-Xero reconciliation service (auto-invoice + auto-match)
- ✅ Xero integration (OAuth2 + API client)
- ✅ Bank feed models (BankFeed, BankAccount tables)
- ✅ Reconciliation algorithm (confidence scoring)

### Desired State

**Automated Process**:
- Bank feed syncs automatically daily at 9am
- Auto-reconciliation runs immediately after sync
- 90%+ transactions auto-matched (80%+ confidence)
- 10-20% flagged for manual review (60-80% confidence)
- 0-10% no match found
- Summary email sent to accounts team
- Zero manual intervention for matched transactions

### Business Impact

**Efficiency**:
- **10+ hours/week saved** for accounts team
- **Zero manual data entry** for matched transactions
- **Same-day reconciliation** vs weekly/monthly

**Accuracy**:
- **Zero human error** in matched transactions
- **Consistent matching logic** (not dependent on staff)
- **Audit trail** for all reconciliation decisions

**Scale**:
- **1000+ transactions/day** handled automatically
- **No additional headcount** needed as volume grows

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│           POS Bank Feed Auto-Sync System                │
└─────────────────────────────────────────────────────────┘

    ┌─────────────┐
    │  Scheduler  │  (APScheduler - runs daily 9am)
    │   (Cron)    │
    └──────┬──────┘
           │
           │ Trigger daily sync
           ▼
    ┌─────────────────────────────────────┐
    │  Bank Feed Sync Service             │
    │  (src/services/bank_feed_service.py)│
    └──────┬──────────────────────────────┘
           │
           │ 1. Fetch bank transactions
           ▼
    ┌─────────────────┐
    │   Xero API      │  GET /BankTransactions
    │  (Bank Feeds)   │  GET /BankAccounts
    └──────┬──────────┘
           │
           │ 2. Store in database
           ▼
    ┌─────────────────┐
    │  BankFeed       │
    │  (Table)        │
    └──────┬──────────┘
           │
           │ 3. Trigger auto-reconciliation
           ▼
    ┌───────────────────────────────────────────┐
    │  POSXeroReconciliation                    │
    │  auto_reconcile_unmatched_transactions()  │
    └──────┬────────────────────────────────────┘
           │
           │ 4. Match logic (confidence scoring)
           ├─> 80%+ confidence → Auto-match
           ├─> 60-80% confidence → Suggest for review
           └─> <60% confidence → No match
           │
           │ 5. Send summary email
           ▼
    ┌─────────────────┐
    │  Email Service  │
    │   (SendGrid)    │
    └─────────────────┘
           │
           │ Email to accounts team:
           │ - Total synced: 250
           │ - Auto-matched: 225 (90%)
           │ - Suggested: 20 (8%)
           │ - No match: 5 (2%)
           ▼
       [Done]
```

---

## Implementation Steps

### Step 1: Create Bank Feed Sync Service (30 mins)

**File**: `apps/backend/src/services/bank_feed_service.py`

```python
"""Bank Feed Sync Service.

Syncs bank transactions from Xero to local database for reconciliation.
"""

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.pos_models import BankAccount, BankFeed
from src.integrations.xero.client import XeroClient

logger = structlog.get_logger(__name__)


class BankFeedSyncService:
    """Service for syncing bank feeds from Xero."""

    def __init__(self, xero_client: XeroClient):
        self.xero_client = xero_client

    async def sync_bank_transactions(
        self,
        db: AsyncSession,
        bank_account_id: UUID,
        start_date: date,
        end_date: date,
    ) -> dict:
        """
        Sync bank transactions from Xero for a specific account and date range.

        Args:
            db: Database session
            bank_account_id: Local bank account UUID
            start_date: Start date for sync
            end_date: End date for sync

        Returns:
            Sync statistics (total synced, new, updated, errors)
        """
        # Get bank account
        bank_account = await db.get(BankAccount, bank_account_id)
        if not bank_account:
            raise ValueError(f"Bank account {bank_account_id} not found")

        if not bank_account.feed_account_id:
            raise ValueError(f"Bank account {bank_account_id} has no Xero feed_account_id")

        logger.info(
            "Starting bank feed sync",
            account_id=str(bank_account_id),
            xero_account_id=bank_account.feed_account_id,
            start_date=str(start_date),
            end_date=str(end_date),
        )

        # Fetch transactions from Xero
        try:
            transactions = await self._fetch_xero_bank_transactions(
                bank_account.feed_account_id,
                start_date,
                end_date,
            )
        except Exception as e:
            logger.error(
                "Failed to fetch Xero bank transactions",
                account_id=str(bank_account_id),
                error=str(e),
            )
            raise

        # Store transactions in database
        stats = {
            "total_fetched": len(transactions),
            "new": 0,
            "updated": 0,
            "errors": 0,
        }

        for txn in transactions:
            try:
                await self._store_bank_transaction(db, bank_account_id, txn)
                stats["new"] += 1
            except Exception as e:
                logger.error(
                    "Failed to store bank transaction",
                    transaction=txn,
                    error=str(e),
                )
                stats["errors"] += 1

        await db.commit()

        # Update last sync time
        bank_account.last_feed_sync_at = datetime.now()
        bank_account.feed_sync_status = "active" if stats["errors"] == 0 else "error"
        await db.commit()

        logger.info(
            "Bank feed sync completed",
            account_id=str(bank_account_id),
            stats=stats,
        )

        return stats

    async def sync_all_bank_accounts(
        self,
        db: AsyncSession,
        days_back: int = 7,
    ) -> dict:
        """
        Sync all active bank accounts for the last N days.

        Args:
            db: Database session
            days_back: Number of days to look back (default: 7)

        Returns:
            Overall sync statistics
        """
        # Get all active bank accounts with feed provider
        result = await db.execute(
            select(BankAccount).where(
                BankAccount.is_active == True,
                BankAccount.feed_provider.isnot(None),
            )
        )
        accounts = result.scalars().all()

        if not accounts:
            logger.warning("No active bank accounts with feed provider found")
            return {"accounts_synced": 0, "total_transactions": 0}

        end_date = date.today()
        start_date = end_date - timedelta(days=days_back)

        overall_stats = {
            "accounts_synced": 0,
            "total_transactions": 0,
            "total_new": 0,
            "total_errors": 0,
        }

        for account in accounts:
            try:
                stats = await self.sync_bank_transactions(
                    db=db,
                    bank_account_id=account.id,
                    start_date=start_date,
                    end_date=end_date,
                )
                overall_stats["accounts_synced"] += 1
                overall_stats["total_transactions"] += stats["total_fetched"]
                overall_stats["total_new"] += stats["new"]
                overall_stats["total_errors"] += stats["errors"]
            except Exception as e:
                logger.error(
                    "Failed to sync bank account",
                    account_id=str(account.id),
                    error=str(e),
                )
                overall_stats["total_errors"] += 1

        return overall_stats

    async def _fetch_xero_bank_transactions(
        self,
        xero_account_id: str,
        start_date: date,
        end_date: date,
    ) -> list[dict]:
        """
        Fetch bank transactions from Xero API.

        Args:
            xero_account_id: Xero bank account ID
            start_date: Start date
            end_date: End date

        Returns:
            List of transaction dictionaries
        """
        # Xero API call
        # GET /BankTransactions?where=BankAccountID="xxx" AND Date>=DateTime(...) AND Date<=DateTime(...)
        where_clause = (
            f'BankAccountID=="{xero_account_id}" '
            f'AND Date>=DateTime({start_date.year},{start_date.month},{start_date.day}) '
            f'AND Date<=DateTime({end_date.year},{end_date.month},{end_date.day})'
        )

        response = await self.xero_client.get(
            endpoint="/BankTransactions",
            params={"where": where_clause},
        )

        transactions = response.get("BankTransactions", [])

        logger.info(
            "Fetched Xero bank transactions",
            xero_account_id=xero_account_id,
            count=len(transactions),
        )

        return transactions

    async def _store_bank_transaction(
        self,
        db: AsyncSession,
        bank_account_id: UUID,
        xero_transaction: dict,
    ) -> BankFeed:
        """
        Store bank transaction in local database.

        Args:
            db: Database session
            bank_account_id: Local bank account UUID
            xero_transaction: Xero transaction data

        Returns:
            BankFeed object
        """
        # Parse Xero transaction
        transaction_id = xero_transaction.get("BankTransactionID")
        transaction_date = datetime.strptime(
            xero_transaction.get("Date"), "%Y-%m-%dT%H:%M:%S"
        ).date()

        # Check if already exists
        result = await db.execute(
            select(BankFeed).where(
                BankFeed.bank_account_id == bank_account_id,
                BankFeed.raw_data["BankTransactionID"].astext == transaction_id,
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            # Update existing
            existing.raw_data = xero_transaction
            existing.updated_at = datetime.now()
            return existing

        # Create new
        line_items = xero_transaction.get("LineItems", [])
        description = line_items[0].get("Description", "") if line_items else ""
        reference = xero_transaction.get("Reference", "")

        # Determine debit/credit
        total = Decimal(str(xero_transaction.get("Total", 0)))
        credit = total if total > 0 else None
        debit = abs(total) if total < 0 else None

        bank_feed = BankFeed(
            bank_account_id=bank_account_id,
            transaction_date=transaction_date,
            description=description,
            reference=reference,
            debit=debit,
            credit=credit,
            balance=None,  # Xero doesn't always provide balance
            match_status="pending",
            raw_data=xero_transaction,
        )

        db.add(bank_feed)
        await db.flush()

        return bank_feed
```

---

### Step 2: Create Scheduler (20 mins)

**File**: `apps/backend/src/scheduler/bank_feed_scheduler.py`

```python
"""Bank Feed Scheduler.

Schedules daily bank feed sync jobs.
"""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

import structlog
from src.config.database import async_session_factory
from src.integrations.xero.auth import XeroAuth
from src.integrations.xero.client import XeroClient
from src.integrations.xero.pos_reconciliation import POSXeroReconciliation
from src.services.bank_feed_service import BankFeedSyncService
from src.services.email_service import EmailService

logger = structlog.get_logger(__name__)

scheduler = AsyncIOScheduler()


async def daily_bank_feed_sync_job():
    """Daily bank feed sync job (runs at 9am)."""
    logger.info("Starting daily bank feed sync job")

    try:
        # Create database session
        async with async_session_factory() as db:
            # Initialize services
            xero_auth = XeroAuth()  # Uses settings from environment
            xero_client = XeroClient(xero_auth)
            bank_feed_service = BankFeedSyncService(xero_client)
            pos_reconciliation = POSXeroReconciliation(xero_auth)
            email_service = EmailService()

            # Step 1: Sync bank feeds (last 7 days)
            logger.info("Step 1: Syncing bank feeds")
            sync_stats = await bank_feed_service.sync_all_bank_accounts(db, days_back=7)

            logger.info("Bank feed sync completed", stats=sync_stats)

            # Step 2: Auto-reconcile unmatched transactions
            logger.info("Step 2: Auto-reconciling transactions")
            # Get organization_id (assume first org for now - TODO: handle multi-tenant)
            from src.db.models import Organization
            from sqlalchemy import select

            org_result = await db.execute(select(Organization).limit(1))
            organization = org_result.scalar_one_or_none()

            if not organization:
                logger.warning("No organization found, skipping reconciliation")
                return

            recon_stats = await pos_reconciliation.auto_reconcile_unmatched_transactions(
                db=db,
                organization_id=organization.id,
                days_back=7,
            )

            logger.info("Auto-reconciliation completed", stats=recon_stats)

            # Step 3: Send summary email
            logger.info("Step 3: Sending summary email")
            await _send_summary_email(
                email_service,
                sync_stats=sync_stats,
                recon_stats=recon_stats,
            )

            logger.info("Daily bank feed sync job completed successfully")

    except Exception as e:
        logger.error("Daily bank feed sync job failed", error=str(e), exc_info=True)
        # TODO: Send error notification email


async def _send_summary_email(
    email_service: EmailService,
    sync_stats: dict,
    recon_stats: dict,
):
    """Send daily reconciliation summary email."""
    total_synced = sync_stats.get("total_transactions", 0)
    auto_matched = recon_stats.get("auto_matched", 0)
    suggested = recon_stats.get("suggested_matches", 0)
    no_match = total_synced - auto_matched - suggested

    auto_match_rate = (auto_matched / total_synced * 100) if total_synced > 0 else 0

    subject = f"Daily Bank Reconciliation Summary - {auto_matched}/{total_synced} Auto-Matched ({auto_match_rate:.1f}%)"

    body = f"""
    <h2>Daily Bank Feed Sync & Reconciliation Summary</h2>

    <h3>Bank Feed Sync</h3>
    <ul>
        <li><strong>Accounts Synced:</strong> {sync_stats.get('accounts_synced', 0)}</li>
        <li><strong>Transactions Fetched:</strong> {total_synced}</li>
        <li><strong>New Transactions:</strong> {sync_stats.get('total_new', 0)}</li>
        <li><strong>Errors:</strong> {sync_stats.get('total_errors', 0)}</li>
    </ul>

    <h3>Auto-Reconciliation Results</h3>
    <ul>
        <li><strong>Auto-Matched (80%+ confidence):</strong> {auto_matched} ({auto_match_rate:.1f}%)</li>
        <li><strong>Suggested for Review (60-80% confidence):</strong> {suggested}</li>
        <li><strong>No Match Found (<60% confidence):</strong> {no_match}</li>
    </ul>

    <h3>Actions Required</h3>
    <p>
        {"✅ <strong>No action needed!</strong> All transactions auto-matched." if suggested == 0 and no_match == 0 else ""}
        {"⚠️ <strong>{} transactions</strong> need manual review in the POS Reconciliation dashboard.".format(suggested) if suggested > 0 else ""}
        {"🔍 <strong>{} transactions</strong> could not be matched and need investigation.".format(no_match) if no_match > 0 else ""}
    </p>

    <p>
        <a href="http://localhost:3000/pos/reconciliation">View POS Reconciliation Dashboard →</a>
    </p>

    <hr>
    <p style="color: #666; font-size: 12px;">
        This is an automated email from CCW ERP Bank Feed Sync Service.<br>
        Scheduled daily at 9:00 AM AEST.
    </p>
    """

    # TODO: Get accounts team email from settings
    to_emails = ["accounts@ccw-erp.com"]

    await email_service.send_email(
        to=to_emails,
        subject=subject,
        html_content=body,
    )

    logger.info(
        "Summary email sent",
        to=to_emails,
        auto_matched=auto_matched,
        suggested=suggested,
        no_match=no_match,
    )


def start_scheduler():
    """Start the background scheduler."""
    # Daily at 9:00 AM AEST (UTC+10)
    # Note: Adjust timezone as needed
    scheduler.add_job(
        daily_bank_feed_sync_job,
        trigger=CronTrigger(hour=9, minute=0, timezone="Australia/Brisbane"),
        id="daily_bank_feed_sync",
        name="Daily Bank Feed Sync & Reconciliation",
        replace_existing=True,
    )

    scheduler.start()
    logger.info("Bank feed scheduler started (daily at 9:00 AM AEST)")


def stop_scheduler():
    """Stop the background scheduler."""
    scheduler.shutdown()
    logger.info("Bank feed scheduler stopped")
```

---

### Step 3: Integrate Scheduler into FastAPI Lifespan (10 mins)

**File**: `apps/backend/src/api/main.py`

Add to lifespan function:

```python
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan context manager."""
    # ... existing startup code ...

    # Start bank feed scheduler
    try:
        from src.scheduler.bank_feed_scheduler import start_scheduler

        start_scheduler()
        logger.info("Bank feed scheduler started")
    except Exception as e:
        logger.error("Failed to start bank feed scheduler", error=str(e))

    yield

    # Shutdown: Stop scheduler
    try:
        from src.scheduler.bank_feed_scheduler import stop_scheduler

        stop_scheduler()
        logger.info("Bank feed scheduler stopped")
    except Exception as e:
        logger.error("Error stopping scheduler", error=str(e))

    # ... existing shutdown code ...
```

---

### Step 4: Create Email Service (if not exists) (20 mins)

**File**: `apps/backend/src/services/email_service.py`

```python
"""Email Service for sending notifications."""

import structlog
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

from src.config import get_settings

logger = structlog.get_logger(__name__)
settings = get_settings()


class EmailService:
    """Service for sending emails via SendGrid."""

    def __init__(self):
        if not settings.sendgrid_api_key:
            logger.warning("SendGrid API key not configured, emails will not send")
            self.client = None
        else:
            self.client = SendGridAPIClient(settings.sendgrid_api_key)

    async def send_email(
        self,
        to: list[str],
        subject: str,
        html_content: str,
        from_email: str = None,
    ) -> bool:
        """
        Send an email.

        Args:
            to: List of recipient email addresses
            subject: Email subject
            html_content: HTML email body
            from_email: From email (default: from settings)

        Returns:
            True if sent successfully, False otherwise
        """
        if not self.client:
            logger.warning("SendGrid not configured, skipping email", subject=subject)
            return False

        if not from_email:
            from_email = settings.sendgrid_from_email or "noreply@ccw-erp.com"

        message = Mail(
            from_email=from_email,
            to_emails=to,
            subject=subject,
            html_content=html_content,
        )

        try:
            response = self.client.send(message)
            logger.info(
                "Email sent successfully",
                to=to,
                subject=subject,
                status_code=response.status_code,
            )
            return True
        except Exception as e:
            logger.error("Failed to send email", to=to, subject=subject, error=str(e))
            return False
```

---

### Step 5: Add API Endpoints for Manual Triggers (15 mins)

**File**: `apps/backend/src/api/routes/bank_feeds.py` (NEW)

```python
"""Bank Feed API endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.integrations.xero.auth import XeroAuth
from src.integrations.xero.client import XeroClient
from src.services.bank_feed_service import BankFeedSyncService

router = APIRouter(prefix="/api/bank-feeds", tags=["Bank Feeds"])


class SyncResponse(BaseModel):
    """Bank feed sync response."""

    accounts_synced: int
    total_transactions: int
    total_new: int
    total_errors: int


@router.post("/sync")
async def sync_bank_feeds(
    days_back: int = Field(default=7, ge=1, le=30),
    db: Annotated[AsyncSession, Depends(get_async_db)] = None,
) -> SyncResponse:
    """
    Manually trigger bank feed sync for all accounts.

    Args:
        days_back: Number of days to look back (default: 7, max: 30)
        db: Database session

    Returns:
        Sync statistics
    """
    xero_auth = XeroAuth()
    xero_client = XeroClient(xero_auth)
    service = BankFeedSyncService(xero_client)

    stats = await service.sync_all_bank_accounts(db, days_back=days_back)

    return SyncResponse(**stats)


@router.post("/sync/{account_id}")
async def sync_single_account(
    account_id: UUID,
    days_back: int = Field(default=7, ge=1, le=30),
    db: Annotated[AsyncSession, Depends(get_async_db)] = None,
) -> dict:
    """
    Manually trigger bank feed sync for a single account.

    Args:
        account_id: Bank account UUID
        days_back: Number of days to look back
        db: Database session

    Returns:
        Sync statistics for the account
    """
    from datetime import date, timedelta

    xero_auth = XeroAuth()
    xero_client = XeroClient(xero_auth)
    service = BankFeedSyncService(xero_client)

    end_date = date.today()
    start_date = end_date - timedelta(days=days_back)

    stats = await service.sync_bank_transactions(
        db=db,
        bank_account_id=account_id,
        start_date=start_date,
        end_date=end_date,
    )

    return stats
```

---

### Step 6: Add Dependencies (5 mins)

**File**: `apps/backend/pyproject.toml`

```toml
dependencies = [
    # ... existing dependencies
    "apscheduler>=3.10.0",  # Job scheduling
]
```

---

### Step 7: Update Settings (5 mins)

**File**: `apps/backend/src/config/__init__.py` (or settings.py)

Add SendGrid settings if not exists:

```python
class Settings(BaseSettings):
    # ... existing settings ...

    # SendGrid (for email notifications)
    sendgrid_api_key: str = Field(default="", env="SENDGRID_API_KEY")
    sendgrid_from_email: str = Field(default="noreply@ccw-erp.com", env="SENDGRID_FROM_EMAIL")

    # Bank Feed Sync
    bank_feed_sync_enabled: bool = Field(default=True, env="BANK_FEED_SYNC_ENABLED")
    bank_feed_sync_hour: int = Field(default=9, env="BANK_FEED_SYNC_HOUR")  # Hour to run (0-23)
```

---

### Step 8: Register Router in main.py (2 mins)

**File**: `apps/backend/src/api/main.py`

```python
from .routes import bank_feeds

# ... existing routers
app.include_router(bank_feeds.router, tags=["Bank Feeds"])
```

---

## Testing Strategy

### Unit Tests

**File**: `apps/backend/tests/unit/test_bank_feed_service.py`

```python
@pytest.mark.asyncio
async def test_sync_bank_transactions(db, mock_xero_client):
    """Test bank feed sync fetches and stores transactions."""
    service = BankFeedSyncService(mock_xero_client)

    # Mock Xero response
    mock_xero_client.get.return_value = {
        "BankTransactions": [
            {
                "BankTransactionID": "123",
                "Date": "2026-01-28T00:00:00",
                "Total": 100.50,
                "Reference": "POS-2026-000123",
                "LineItems": [{"Description": "Walk-in sale"}],
            }
        ]
    }

    # Create test bank account
    bank_account = BankAccount(
        id=uuid4(),
        account_name="Test Account",
        feed_account_id="xero-123",
    )
    db.add(bank_account)
    await db.commit()

    # Run sync
    stats = await service.sync_bank_transactions(
        db=db,
        bank_account_id=bank_account.id,
        start_date=date(2026, 1, 21),
        end_date=date(2026, 1, 28),
    )

    # Assertions
    assert stats["total_fetched"] == 1
    assert stats["new"] == 1
    assert stats["errors"] == 0

    # Verify stored in database
    result = await db.execute(select(BankFeed))
    bank_feeds = result.scalars().all()
    assert len(bank_feeds) == 1
    assert bank_feeds[0].reference == "POS-2026-000123"
```

### Integration Tests

```bash
# Manual trigger
curl -X POST http://localhost:8000/api/bank-feeds/sync?days_back=7

# Expected response:
# {
#   "accounts_synced": 2,
#   "total_transactions": 150,
#   "total_new": 20,
#   "total_errors": 0
# }

# Check reconciliation ran
curl http://localhost:8000/api/pos/reconciliation-stats

# Expected: reconciliation_rate increased
```

### Scheduler Tests

```python
# Test scheduler starts/stops
def test_scheduler_lifecycle():
    start_scheduler()
    assert scheduler.running is True

    stop_scheduler()
    assert scheduler.running is False

# Test job is registered
def test_job_registered():
    start_scheduler()
    jobs = scheduler.get_jobs()
    assert any(job.id == "daily_bank_feed_sync" for job in jobs)
```

---

## Success Criteria

- ✅ Bank feeds sync daily at 9am automatically
- ✅ Auto-reconciliation runs after each sync
- ✅ 90%+ transactions auto-matched (80%+ confidence)
- ✅ Summary email sent to accounts team daily
- ✅ Manual sync endpoint available (/api/bank-feeds/sync)
- ✅ Scheduler starts on app startup, stops on shutdown
- ✅ Errors logged and reported in summary email
- ✅ No manual intervention needed for matched transactions

---

## Breaking Changes

**None** - This is additive only:
- New service (BankFeedSyncService)
- New scheduler (bank_feed_scheduler)
- New API endpoints (/api/bank-feeds/sync)
- No existing code modified (except main.py lifespan)

---

## Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Scheduler failures | MEDIUM | LOW | Comprehensive error logging, retry logic |
| Email not sent | LOW | MEDIUM | Log warnings, continue processing |
| Xero API rate limits | MEDIUM | LOW | Fetch only last 7 days, respect rate limits |
| Database connection leaks | HIGH | LOW | Use async context managers |
| Time zone issues | MEDIUM | MEDIUM | Use Australia/Brisbane timezone explicitly |

---

## Deployment Checklist

**Before Deployment**:
- [ ] Set `SENDGRID_API_KEY` in .env
- [ ] Set `SENDGRID_FROM_EMAIL` in .env
- [ ] Verify Xero OAuth2 token valid
- [ ] Test manual sync endpoint
- [ ] Verify email template renders correctly

**After Deployment**:
- [ ] Verify scheduler started (check logs)
- [ ] Wait for 9am next day, verify job runs
- [ ] Check summary email received
- [ ] Verify reconciliation stats improved

---

## Estimated Timeline

| Task | Time | Cumulative |
|------|------|------------|
| Bank Feed Sync Service | 30 mins | 30 mins |
| Scheduler | 20 mins | 50 mins |
| Integrate into FastAPI | 10 mins | 60 mins |
| Email Service | 20 mins | 80 mins |
| API Endpoints | 15 mins | 95 mins |
| Dependencies | 5 mins | 100 mins |
| Settings | 5 mins | 105 mins |
| Register Router | 2 mins | 107 mins |
| Testing | 30 mins | 137 mins |
| Documentation | 15 mins | 152 mins |

**Total**: ~2.5 hours (conservative: 1 day with testing)

---

## Expected Business Impact

**Efficiency**:
- **10+ hours/week saved** for accounts team
- **Zero manual data entry** for 90%+ of transactions
- **Same-day reconciliation** (vs weekly/monthly delays)

**Accuracy**:
- **Zero human error** in auto-matched transactions
- **Consistent matching logic** (not dependent on staff knowledge)
- **Complete audit trail** (confidence scores logged)

**Scale**:
- **1000+ transactions/day** handled automatically
- **No additional headcount** needed as transaction volume grows
- **Predictable operations** (runs same time daily)

---

## Approval Required

This plan is ready for implementation. Awaiting user approval to proceed.

**Expected Outcome**: 90%+ auto-reconciliation rate achieved, 10+ hours/week saved for accounts team.

---

**Plan Created By**: Claude Sonnet 4.5
**Date**: 2026-01-28
**Priority**: P1-1 (High)
**Effort**: 5 points (1-2 days)
