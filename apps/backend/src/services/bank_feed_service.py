"""
Bank Feed Service.

Handles:
- Syncing bank feed data from providers (Xero, Yodlee, Basiq)
- Auto-matching transactions with POS records
- Manual reconciliation workflow
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.pos_models import BankAccount, BankFeed, POSTransaction


class BankFeedService:
    """Service for bank feed synchronization and reconciliation."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.tolerance_cents = Decimal("0.10")  # ±10 cents tolerance for auto-match

    async def sync_bank_feeds(
        self,
        account_id: UUID,
        start_date: date,
        end_date: date,
    ) -> dict:
        """
        Sync bank feed data for a specific account and date range.

        Args:
            account_id: Bank account ID
            start_date: Start date for sync
            end_date: End date for sync

        Returns:
            Sync result with transaction count

        Raises:
            ValueError: If account not found or feed provider not configured
        """
        # Get bank account
        account_result = await self.db.execute(
            select(BankAccount).where(BankAccount.id == account_id)
        )
        account = account_result.scalar_one_or_none()

        if not account:
            raise ValueError(f"Bank account {account_id} not found")

        if not account.feed_provider:
            raise ValueError(f"No feed provider configured for account {account.account_name}")

        # Fetch transactions from provider
        if account.feed_provider == "xero":
            transactions = await self._fetch_xero_bank_feed(account, start_date, end_date)
        elif account.feed_provider == "yodlee":
            transactions = await self._fetch_yodlee_bank_feed(account, start_date, end_date)
        elif account.feed_provider == "basiq":
            transactions = await self._fetch_basiq_bank_feed(account, start_date, end_date)
        elif account.feed_provider == "manual":
            # Manual CSV upload - handled separately
            return {"transactions_synced": 0, "provider": "manual"}
        else:
            raise ValueError(f"Unsupported feed provider: {account.feed_provider}")

        # Store transactions in database
        for txn in transactions:
            bank_feed = BankFeed(
                bank_account_id=account_id,
                transaction_date=txn["transaction_date"],
                description=txn.get("description"),
                reference=txn.get("reference"),
                debit=txn.get("debit"),
                credit=txn.get("credit"),
                balance=txn.get("balance"),
                raw_data=txn,
            )
            self.db.add(bank_feed)

        await self.db.flush()

        # Update account sync status
        account.last_feed_sync_at = datetime.now()
        account.feed_sync_status = "active"

        await self.db.commit()

        # Auto-reconcile exact matches
        await self.auto_reconcile(account_id)

        return {
            "transactions_synced": len(transactions),
            "provider": account.feed_provider,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
        }

    async def _fetch_xero_bank_feed(
        self,
        account: BankAccount,
        start_date: date,
        end_date: date,
    ) -> list[dict]:
        """
        Fetch bank feed data from Xero.

        Uses existing Xero integration to pull bank transactions.
        """
        # TODO: Integrate with existing Xero client
        # from src.integrations.xero.client import get_xero_client
        #
        # xero_client = get_xero_client()
        # bank_transactions = await xero_client.get_bank_transactions(
        #     account_id=account.feed_account_id,
        #     from_date=start_date,
        #     to_date=end_date,
        # )
        #
        # return [
        #     {
        #         "transaction_date": txn["Date"],
        #         "description": txn["Description"],
        #         "reference": txn["Reference"],
        #         "credit": Decimal(txn["Credit"]) if txn.get("Credit") else None,
        #         "debit": Decimal(txn["Debit"]) if txn.get("Debit") else None,
        #         "balance": Decimal(txn["Balance"]),
        #     }
        #     for txn in bank_transactions
        # ]

        # Mock implementation for Phase 3D
        import random

        mock_transactions = []
        current_date = start_date
        balance = Decimal("10000.00")

        while current_date <= end_date:
            # Generate 0-3 transactions per day
            num_txns = random.randint(0, 3)
            for _ in range(num_txns):
                amount = Decimal(str(random.uniform(10, 500))).quantize(Decimal("0.01"))
                is_credit = random.choice([True, False])

                if is_credit:
                    balance += amount
                    mock_transactions.append({
                        "transaction_date": current_date,
                        "description": f"EFTPOS PURCHASE {random.randint(1000, 9999)}",
                        "reference": f"REF{random.randint(100000, 999999)}",
                        "credit": amount,
                        "debit": None,
                        "balance": balance,
                    })
                else:
                    balance -= amount
                    mock_transactions.append({
                        "transaction_date": current_date,
                        "description": f"PAYMENT TO SUPPLIER",
                        "reference": f"REF{random.randint(100000, 999999)}",
                        "credit": None,
                        "debit": amount,
                        "balance": balance,
                    })

            current_date = date(current_date.year, current_date.month, current_date.day + 1)

        return mock_transactions

    async def _fetch_yodlee_bank_feed(
        self,
        account: BankAccount,
        start_date: date,
        end_date: date,
    ) -> list[dict]:
        """Fetch bank feed data from Yodlee aggregation service."""
        # TODO: Integrate with Yodlee API
        return []

    async def _fetch_basiq_bank_feed(
        self,
        account: BankAccount,
        start_date: date,
        end_date: date,
    ) -> list[dict]:
        """Fetch bank feed data from Basiq open banking."""
        # TODO: Integrate with Basiq API
        return []

    async def auto_reconcile(self, account_id: UUID) -> dict:
        """
        Auto-reconcile unmatched bank feeds with POS transactions.

        Matching criteria:
        1. Amount matches (within tolerance)
        2. Date matches (±3 days)
        3. Reference number matches (if available)

        Returns:
            Reconciliation result with match count
        """
        # Get unmatched bank feeds
        unmatched_feeds = await self.db.execute(
            select(BankFeed)
            .where(
                and_(
                    BankFeed.bank_account_id == account_id,
                    BankFeed.match_status == "pending",
                )
            )
            .limit(1000)  # Process in batches
        )
        feeds = unmatched_feeds.scalars().all()

        matched_count = 0

        for feed in feeds:
            # Only match credit transactions (money in = sales)
            if not feed.credit:
                continue

            # Find matching POS transactions
            # Match criteria: amount ± tolerance, date ± 3 days
            from_date = date(
                feed.transaction_date.year,
                feed.transaction_date.month,
                feed.transaction_date.day - 3,
            )
            to_date = date(
                feed.transaction_date.year,
                feed.transaction_date.month,
                feed.transaction_date.day + 3,
            )

            pos_query = select(POSTransaction).where(
                and_(
                    func.date(POSTransaction.created_at) >= from_date,
                    func.date(POSTransaction.created_at) <= to_date,
                    POSTransaction.amount.between(
                        feed.credit - self.tolerance_cents,
                        feed.credit + self.tolerance_cents,
                    ),
                    POSTransaction.reconciliation_status == "pending",
                )
            )

            # Check for reference match
            if feed.reference:
                pos_query = pos_query.where(
                    or_(
                        POSTransaction.transaction_number == feed.reference,
                        POSTransaction.payment_gateway_ref.ilike(f"%{feed.reference}%"),
                    )
                )

            pos_result = await self.db.execute(pos_query)
            pos_transaction = pos_result.scalar_one_or_none()

            if pos_transaction:
                # Calculate match confidence
                confidence = self._calculate_match_confidence(feed, pos_transaction)

                if confidence >= Decimal("0.80"):  # 80% confidence threshold
                    # Auto-match
                    feed.matched_pos_transaction_id = pos_transaction.id
                    feed.match_confidence = confidence
                    feed.match_status = "auto_matched"
                    feed.matched_at = datetime.now()

                    pos_transaction.bank_statement_ref = feed.reference
                    pos_transaction.reconciliation_status = "matched"
                    pos_transaction.reconciled_at = datetime.now()

                    matched_count += 1

        await self.db.commit()

        return {
            "feeds_processed": len(feeds),
            "auto_matched": matched_count,
        }

    def _calculate_match_confidence(
        self, feed: BankFeed, pos_transaction: POSTransaction
    ) -> Decimal:
        """
        Calculate match confidence score (0.00 to 1.00).

        Factors:
        - Amount exact match: +0.50
        - Amount within tolerance: +0.30
        - Date exact match: +0.30
        - Date within ±1 day: +0.20
        - Reference match: +0.20
        """
        confidence = Decimal("0.00")

        # Amount match
        amount_diff = abs(feed.credit - pos_transaction.amount)
        if amount_diff == 0:
            confidence += Decimal("0.50")
        elif amount_diff <= self.tolerance_cents:
            confidence += Decimal("0.30")

        # Date match
        feed_date = feed.transaction_date
        pos_date = pos_transaction.created_at.date()
        date_diff = abs((feed_date - pos_date).days)

        if date_diff == 0:
            confidence += Decimal("0.30")
        elif date_diff <= 1:
            confidence += Decimal("0.20")

        # Reference match
        if feed.reference and (
            feed.reference == pos_transaction.transaction_number
            or (
                pos_transaction.payment_gateway_ref
                and feed.reference in pos_transaction.payment_gateway_ref
            )
        ):
            confidence += Decimal("0.20")

        return min(confidence, Decimal("1.00"))  # Cap at 1.00

    async def manual_reconcile(
        self,
        feed_id: UUID,
        pos_transaction_id: UUID,
        user_id: UUID,
    ) -> dict:
        """
        Manually reconcile a bank feed with a POS transaction.

        Args:
            feed_id: Bank feed ID
            pos_transaction_id: POS transaction ID
            user_id: User performing reconciliation

        Returns:
            Reconciliation result

        Raises:
            ValueError: If validation fails
        """
        # Get bank feed
        feed_result = await self.db.execute(select(BankFeed).where(BankFeed.id == feed_id))
        feed = feed_result.scalar_one_or_none()

        if not feed:
            raise ValueError(f"Bank feed {feed_id} not found")

        # Get POS transaction
        pos_result = await self.db.execute(
            select(POSTransaction).where(POSTransaction.id == pos_transaction_id)
        )
        pos_transaction = pos_result.scalar_one_or_none()

        if not pos_transaction:
            raise ValueError(f"POS transaction {pos_transaction_id} not found")

        # Validate amounts match (within tolerance)
        if feed.credit:
            amount_diff = abs(feed.credit - pos_transaction.amount)
            if amount_diff > self.tolerance_cents:
                raise ValueError(
                    f"Amount mismatch: Bank {feed.credit}, POS {pos_transaction.amount}"
                )

        # Link transactions
        feed.matched_pos_transaction_id = pos_transaction_id
        feed.match_status = "manual_matched"
        feed.match_confidence = Decimal("1.00")  # Manual match = 100% confidence
        feed.matched_at = datetime.now()
        feed.matched_by = user_id

        pos_transaction.bank_statement_ref = feed.reference
        pos_transaction.reconciliation_status = "matched"
        pos_transaction.reconciled_at = datetime.now()
        pos_transaction.reconciled_by = user_id

        await self.db.commit()

        return {
            "feed_id": feed_id,
            "pos_transaction_id": pos_transaction_id,
            "status": "matched",
        }
