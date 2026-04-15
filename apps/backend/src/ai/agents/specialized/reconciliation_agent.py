"""
Reconciliation Agent for AI-powered bank feed matching.

Uses fuzzy matching and pattern learning to suggest POS transaction matches
for bank feed entries with improved accuracy.
"""

AGENT_CARD = {
    "name": "reconciliation_agent",
    "display_name": "Reconciliation Agent",
    "description": "AI-powered bank feed reconciliation using fuzzy matching and pattern learning to suggest POS transaction matches with confidence scoring",
    "version": "1.0.0",
    "capabilities": ["bank_reconciliation", "fuzzy_matching", "confidence_scoring", "pattern_learning", "pos_matching"],
    "input_schema": {
        "type": "object",
        "properties": {
            "feed_id": {"type": "string", "description": "Bank feed UUID to generate match suggestions for"},
            "max_suggestions": {"type": "integer", "description": "Maximum number of match suggestions to return (default: 3)"},
        },
        "required": ["feed_id"],
    },
    "output_schema": {
        "type": "object",
        "properties": {
            "content": {"type": "string"},
            "metadata": {"type": "object"},
        },
    },
}

from datetime import timedelta
from decimal import Decimal
from uuid import UUID

import structlog
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.pos_models import BankFeed, POSTransaction

logger = structlog.get_logger(__name__)


class ReconciliationAgent:
    """
    AI-powered agent for bank feed reconciliation.

    Features:
    - Fuzzy string matching for descriptions
    - Pattern learning from historical matches
    - Confidence scoring with multiple factors
    - Top-N match suggestions
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.tolerance_cents = Decimal("0.10")  # ±10 cents tolerance

    async def generate_match_suggestions(
        self,
        feed_id: UUID,
        max_suggestions: int = 3,
    ) -> list[dict]:
        """
        Generate AI-powered match suggestions for a bank feed.

        Args:
            feed_id: Bank feed ID
            max_suggestions: Maximum number of suggestions to return

        Returns:
            List of match suggestions with confidence scores
        """
        # Get bank feed
        feed_result = await self.db.execute(
            select(BankFeed).where(BankFeed.id == feed_id)
        )
        feed = feed_result.scalar_one_or_none()

        if not feed:
            logger.warning("Bank feed not found", feed_id=str(feed_id))
            return []

        # Only suggest matches for credit transactions (sales)
        if not feed.credit:
            return []

        # Find candidate POS transactions
        candidates = await self._find_candidate_transactions(feed)

        # Score each candidate
        suggestions = []
        for candidate in candidates:
            confidence = await self._calculate_enhanced_confidence(feed, candidate)

            if confidence >= Decimal("0.50"):  # Minimum 50% confidence for suggestions
                suggestions.append({
                    "pos_transaction_id": str(candidate.id),
                    "transaction_number": candidate.transaction_number,
                    "amount": float(candidate.amount),
                    "date": candidate.created_at.date().isoformat(),
                    "payment_method": candidate.payment_method,
                    "confidence": float(confidence),
                    "match_reasons": self._explain_match(feed, candidate, confidence),
                })

        # Sort by confidence (highest first) and limit
        suggestions.sort(key=lambda x: x["confidence"], reverse=True)
        return suggestions[:max_suggestions]

    async def _find_candidate_transactions(self, feed: BankFeed) -> list[POSTransaction]:
        """
        Find candidate POS transactions for matching.

        Criteria:
        - Amount within tolerance
        - Date within ±7 days (extended from ±3 for suggestions)
        - Not already reconciled
        """
        # Date range: ±7 days for suggestions
        from_date = feed.transaction_date - timedelta(days=7)
        to_date = feed.transaction_date + timedelta(days=7)

        query = select(POSTransaction).where(
            and_(
                func.date(POSTransaction.created_at) >= from_date,
                func.date(POSTransaction.created_at) <= to_date,
                POSTransaction.amount.between(
                    feed.credit - self.tolerance_cents,
                    feed.credit + self.tolerance_cents,
                ),
                POSTransaction.reconciliation_status == "pending",
                POSTransaction.payment_status == "captured",  # Only captured payments
            )
        )

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def _calculate_enhanced_confidence(
        self, feed: BankFeed, pos_transaction: POSTransaction
    ) -> Decimal:
        """
        Calculate enhanced confidence score using multiple factors.

        Factors:
        - Amount match (0-50 points)
        - Date proximity (0-25 points)
        - Reference match (0-15 points)
        - Description fuzzy match (0-10 points)
        - Historical pattern match (0-10 points bonus)

        Total: 0-100 points (returned as 0.00-1.00)
        """
        confidence = Decimal("0.00")

        # 1. Amount matching (up to 50 points)
        amount_diff = abs(feed.credit - pos_transaction.amount)
        if amount_diff == 0:
            confidence += Decimal("0.50")
        elif amount_diff <= self.tolerance_cents:
            confidence += Decimal("0.35")
        else:
            # Proportional scoring
            confidence += max(Decimal("0.00"), Decimal("0.20") * (1 - (amount_diff / feed.credit)))

        # 2. Date proximity (up to 25 points)
        feed_date = feed.transaction_date
        pos_date = pos_transaction.created_at.date()
        date_diff = abs((feed_date - pos_date).days)

        if date_diff == 0:
            confidence += Decimal("0.25")
        elif date_diff == 1:
            confidence += Decimal("0.20")
        elif date_diff <= 3:
            confidence += Decimal("0.15")
        elif date_diff <= 7:
            confidence += Decimal("0.10")

        # 3. Reference matching (up to 15 points)
        if feed.reference and pos_transaction.payment_gateway_ref:
            if feed.reference in pos_transaction.payment_gateway_ref:
                confidence += Decimal("0.15")
            elif self._fuzzy_match(feed.reference, pos_transaction.payment_gateway_ref):
                confidence += Decimal("0.10")

        # Also check transaction number
        if feed.reference == pos_transaction.transaction_number:
            confidence += Decimal("0.15")

        # 4. Description fuzzy matching (up to 10 points)
        if feed.description:
            description_score = self._fuzzy_description_match(
                feed.description, pos_transaction
            )
            confidence += description_score

        # 5. Historical pattern bonus (up to 10 points)
        # TODO: Implement learning from past matches
        # For now, give bonus for common payment methods
        if "EFTPOS" in (feed.description or "").upper() and pos_transaction.payment_method == "eftpos":
            confidence += Decimal("0.05")
        if "AMEX" in (feed.description or "").upper() and pos_transaction.payment_method == "amex":
            confidence += Decimal("0.05")

        return min(confidence, Decimal("1.00"))  # Cap at 100%

    def _fuzzy_match(self, str1: str, str2: str, threshold: float = 0.7) -> bool:
        """
        Fuzzy string matching using simple character overlap.

        For production, consider using python-Levenshtein for better accuracy.
        """
        str1_clean = str1.upper().replace(" ", "")
        str2_clean = str2.upper().replace(" ", "")

        # Substring match — one string fully contained in the other
        if str1_clean in str2_clean or str2_clean in str1_clean:
            return True

        # Simple overlap ratio
        common = sum(1 for c in str1_clean if c in str2_clean)
        overlap = common / max(len(str1_clean), len(str2_clean))

        return overlap >= threshold

    def _fuzzy_description_match(
        self, description: str, pos_transaction: POSTransaction
    ) -> Decimal:
        """
        Match bank feed description with POS transaction details.

        Looks for common patterns like:
        - EFTPOS, POS, PURCHASE
        - Payment gateway identifiers
        - Location names
        """
        score = Decimal("0.00")
        desc_upper = description.upper()

        # Check for payment method keywords
        payment_keywords = {
            "EFTPOS": "eftpos",
            "AMEX": "amex",
            "BANK TRANSFER": "bank_transfer",
        }

        for keyword, method in payment_keywords.items():
            if keyword in desc_upper and pos_transaction.payment_method == method:
                score += Decimal("0.05")

        # Check for transaction number in description
        if pos_transaction.transaction_number in description:
            score += Decimal("0.05")

        return min(score, Decimal("0.10"))  # Max 10 points

    def _explain_match(
        self, feed: BankFeed, pos_transaction: POSTransaction, confidence: Decimal
    ) -> list[str]:
        """
        Generate human-readable explanations for why this match was suggested.
        """
        reasons = []

        # Amount
        amount_diff = abs(feed.credit - pos_transaction.amount)
        if amount_diff == 0:
            reasons.append("Exact amount match")
        elif amount_diff <= self.tolerance_cents:
            reasons.append(f"Amount match within {float(self.tolerance_cents)}¢")

        # Date
        date_diff = abs((feed.transaction_date - pos_transaction.created_at.date()).days)
        if date_diff == 0:
            reasons.append("Same date")
        elif date_diff == 1:
            reasons.append("1 day apart")
        elif date_diff <= 3:
            reasons.append(f"{date_diff} days apart")
        else:
            reasons.append(f"{date_diff} days apart (wide window)")

        # Reference
        if feed.reference and pos_transaction.payment_gateway_ref:
            if feed.reference in pos_transaction.payment_gateway_ref:
                reasons.append("Reference number match")

        # Payment method
        if feed.description:
            if "EFTPOS" in feed.description.upper() and pos_transaction.payment_method == "eftpos":
                reasons.append("EFTPOS payment method")
            elif "AMEX" in feed.description.upper() and pos_transaction.payment_method == "amex":
                reasons.append("AMEX payment method")

        # Confidence level
        if confidence >= Decimal("0.90"):
            reasons.append("Very high confidence match")
        elif confidence >= Decimal("0.80"):
            reasons.append("High confidence match")
        elif confidence >= Decimal("0.70"):
            reasons.append("Good confidence match")
        else:
            reasons.append("Moderate confidence - review recommended")

        return reasons

    async def bulk_generate_suggestions(
        self,
        account_id: UUID,
        max_feeds: int = 50,
    ) -> dict:
        """
        Bulk generate suggestions for pending bank feeds.

        Args:
            account_id: Bank account ID
            max_feeds: Maximum number of feeds to process

        Returns:
            Summary statistics
        """
        # Get pending bank feeds
        pending_feeds = await self.db.execute(
            select(BankFeed)
            .where(
                and_(
                    BankFeed.bank_account_id == account_id,
                    BankFeed.match_status == "pending",
                )
            )
            .limit(max_feeds)
        )
        feeds = pending_feeds.scalars().all()

        processed = 0
        with_suggestions = 0

        for feed in feeds:
            suggestions = await self.generate_match_suggestions(feed.id)

            if suggestions:
                # Store suggestions in the database
                feed.match_suggestions = suggestions
                with_suggestions += 1

            processed += 1

        await self.db.commit()

        logger.info(
            "Bulk suggestion generation completed",
            account_id=str(account_id),
            processed=processed,
            with_suggestions=with_suggestions,
        )

        return {
            "processed": processed,
            "with_suggestions": with_suggestions,
            "without_suggestions": processed - with_suggestions,
        }
