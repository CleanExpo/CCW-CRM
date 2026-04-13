"""Tests for Email Audit Service.

Tests cover:
- Email logging creation and updates
- SendGrid webhook event processing
- Consent management
- GDPR data export
- Suppression list management

ISS-037: Email audit trail for GDPR compliance
"""

import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.email_audit_models import (
    EmailConsent,
    EmailLog,
    EmailPurpose,
    EmailStatus,
)
from src.services.email_audit_service import EmailAuditService, strip_html_tags


class TestStripHtmlTags:
    """Test HTML stripping utility."""

    def test_strips_basic_tags(self):
        """Test removing basic HTML tags."""
        html = "<p>Hello <strong>World</strong></p>"
        result = strip_html_tags(html)
        assert result == "Hello World"

    def test_strips_style_tags_with_content(self):
        """Test removing style tags with their content."""
        html = "<p>Hello</p><style>body { color: red; }</style><p>World</p>"
        result = strip_html_tags(html)
        assert "color" not in result
        assert "Hello" in result
        assert "World" in result

    def test_strips_script_tags_with_content(self):
        """Test removing script tags with their content."""
        html = "<p>Safe</p><script>alert('XSS')</script><p>Text</p>"
        result = strip_html_tags(html)
        assert "alert" not in result
        assert "Safe" in result
        assert "Text" in result

    def test_converts_html_entities(self):
        """Test converting HTML entities."""
        html = "<p>Hello &amp; World &lt;3</p>"
        result = strip_html_tags(html)
        assert "Hello & World <3" in result

    def test_normalizes_whitespace(self):
        """Test normalizing multiple whitespace."""
        html = "<p>Hello</p>   \n\n   <p>World</p>"
        result = strip_html_tags(html)
        # Should have single space between words
        assert "  " not in result

    def test_empty_string(self):
        """Test handling empty string."""
        assert strip_html_tags("") == ""

    def test_none_returns_empty(self):
        """Test handling None input."""
        assert strip_html_tags(None) == ""


class TestEmailAuditService:
    """Test EmailAuditService methods."""

    @pytest.fixture
    def mock_db(self):
        """Create mock async database session."""
        db = AsyncMock(spec=AsyncSession)
        db.add = MagicMock()
        db.flush = AsyncMock()
        db.commit = AsyncMock()
        return db

    @pytest.fixture
    def service(self, mock_db):
        """Create EmailAuditService with mock DB."""
        return EmailAuditService(mock_db)

    @pytest.mark.asyncio
    async def test_create_email_log_basic(self, service, mock_db):
        """Test creating a basic email log entry."""
        result = await service.create_email_log(
            recipient_email="test@example.com",
            recipient_name="Test User",
            from_email="noreply@ccw.com",
            from_name="CCW Equipment",
            subject="Test Email",
            html_content="<p>Hello</p>",
        )

        # Verify log was added to session
        mock_db.add.assert_called_once()
        mock_db.flush.assert_called_once()

        # Verify returned log has correct data
        added_log = mock_db.add.call_args[0][0]
        assert added_log.recipient_email == "test@example.com"
        assert added_log.recipient_name == "Test User"
        assert added_log.from_email == "noreply@ccw.com"
        assert added_log.subject == "Test Email"
        assert added_log.status == EmailStatus.QUEUED.value
        assert added_log.purpose == EmailPurpose.TRANSACTIONAL.value

    @pytest.mark.asyncio
    async def test_create_email_log_auto_text_content(self, service, mock_db):
        """Test auto-generating text content from HTML."""
        await service.create_email_log(
            recipient_email="test@example.com",
            recipient_name=None,
            from_email="noreply@ccw.com",
            from_name=None,
            subject="Test",
            html_content="<p>Hello World</p>",
            text_content=None,  # Should be auto-generated
        )

        added_log = mock_db.add.call_args[0][0]
        assert "Hello World" in added_log.text_content

    @pytest.mark.asyncio
    async def test_create_email_log_with_metadata(self, service, mock_db):
        """Test creating log with full metadata."""
        user_id = uuid.uuid4()
        customer_id = uuid.uuid4()
        order_id = uuid.uuid4()

        await service.create_email_log(
            recipient_email="customer@example.com",
            recipient_name="Customer Name",
            from_email="orders@ccw.com",
            from_name="CCW Orders",
            subject="Order Confirmation",
            html_content="<p>Your order is confirmed</p>",
            purpose=EmailPurpose.TRANSACTIONAL,
            user_id=user_id,
            customer_id=customer_id,
            related_entity_type="order",
            related_entity_id=order_id,
            metadata={"order_number": "ORD-001"},
        )

        added_log = mock_db.add.call_args[0][0]
        assert added_log.purpose == EmailPurpose.TRANSACTIONAL.value
        assert added_log.user_id == user_id
        assert added_log.customer_id == customer_id
        assert added_log.related_entity_type == "order"
        assert added_log.related_entity_id == order_id
        assert added_log.extra_metadata == {"order_number": "ORD-001"}

    @pytest.mark.asyncio
    async def test_mark_email_sent(self, service, mock_db):
        """Test marking email as sent."""
        email_log_id = uuid.uuid4()
        sendgrid_message_id = "abc123.xyz"

        # Mock finding the email log
        mock_log = EmailLog(
            id=email_log_id,
            recipient_email="test@example.com",
            from_email="noreply@ccw.com",
            subject="Test",
            status=EmailStatus.QUEUED.value,
            purpose=EmailPurpose.TRANSACTIONAL.value,
        )

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_log
        mock_db.execute.return_value = mock_result

        result = await service.mark_email_sent(email_log_id, sendgrid_message_id)

        assert result is not None
        assert result.status == EmailStatus.SENT.value
        assert result.sendgrid_message_id == sendgrid_message_id
        assert result.sent_at is not None

    @pytest.mark.asyncio
    async def test_mark_email_sent_not_found(self, service, mock_db):
        """Test marking non-existent email as sent."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        result = await service.mark_email_sent(uuid.uuid4(), "abc123")

        assert result is None

    @pytest.mark.asyncio
    async def test_mark_email_failed(self, service, mock_db):
        """Test marking email as failed."""
        email_log_id = uuid.uuid4()

        mock_log = EmailLog(
            id=email_log_id,
            recipient_email="test@example.com",
            from_email="noreply@ccw.com",
            subject="Test",
            status=EmailStatus.QUEUED.value,
            purpose=EmailPurpose.TRANSACTIONAL.value,
        )

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_log
        mock_db.execute.return_value = mock_result

        result = await service.mark_email_failed(
            email_log_id, "Connection timeout", "TIMEOUT"
        )

        assert result is not None
        assert result.status == EmailStatus.FAILED.value
        assert result.error_message == "Connection timeout"
        assert result.error_code == "TIMEOUT"


class TestSendGridWebhookProcessing:
    """Test SendGrid webhook event processing."""

    @pytest.fixture
    def mock_db(self):
        """Create mock async database session."""
        db = AsyncMock(spec=AsyncSession)
        db.add = MagicMock()
        db.flush = AsyncMock()
        return db

    @pytest.fixture
    def service(self, mock_db):
        """Create EmailAuditService with mock DB."""
        return EmailAuditService(mock_db)

    @pytest.mark.asyncio
    async def test_process_delivered_event(self, service, mock_db):
        """Test processing delivered event."""
        email_log = EmailLog(
            id=uuid.uuid4(),
            recipient_email="test@example.com",
            from_email="noreply@ccw.com",
            subject="Test",
            status=EmailStatus.SENT.value,
            purpose=EmailPurpose.TRANSACTIONAL.value,
            sendgrid_message_id="abc123",
        )

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = email_log
        mock_db.execute.return_value = mock_result

        event = {
            "event": "delivered",
            "sg_message_id": "abc123",
            "timestamp": 1707734400,  # 2024-02-12 12:00:00 UTC
        }

        result = await service.process_sendgrid_event(event)

        assert result is True
        assert email_log.status == EmailStatus.DELIVERED.value
        assert email_log.delivered_at is not None

    @pytest.mark.asyncio
    async def test_process_open_event(self, service, mock_db):
        """Test processing open event."""
        email_log = EmailLog(
            id=uuid.uuid4(),
            recipient_email="test@example.com",
            from_email="noreply@ccw.com",
            subject="Test",
            status=EmailStatus.DELIVERED.value,
            purpose=EmailPurpose.TRANSACTIONAL.value,
            sendgrid_message_id="abc123",
            open_count=0,
        )

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = email_log
        mock_db.execute.return_value = mock_result

        event = {
            "event": "open",
            "sg_message_id": "abc123",
            "timestamp": 1707734400,
        }

        result = await service.process_sendgrid_event(event)

        assert result is True
        assert email_log.status == EmailStatus.OPENED.value
        assert email_log.open_count == 1
        assert email_log.opened_at is not None

    @pytest.mark.asyncio
    async def test_process_multiple_open_events(self, service, mock_db):
        """Test processing multiple open events."""
        first_open_time = datetime(2024, 2, 12, 12, 0, 0, tzinfo=UTC)
        email_log = EmailLog(
            id=uuid.uuid4(),
            recipient_email="test@example.com",
            from_email="noreply@ccw.com",
            subject="Test",
            status=EmailStatus.OPENED.value,
            purpose=EmailPurpose.TRANSACTIONAL.value,
            sendgrid_message_id="abc123",
            open_count=1,
            opened_at=first_open_time,
        )

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = email_log
        mock_db.execute.return_value = mock_result

        event = {
            "event": "open",
            "sg_message_id": "abc123",
            "timestamp": 1707820800,  # Later timestamp
        }

        result = await service.process_sendgrid_event(event)

        assert result is True
        assert email_log.open_count == 2
        # First open time should be preserved
        assert email_log.opened_at == first_open_time

    @pytest.mark.asyncio
    async def test_process_bounce_event(self, service, mock_db):
        """Test processing bounce event."""
        email_log = EmailLog(
            id=uuid.uuid4(),
            recipient_email="invalid@example.com",
            from_email="noreply@ccw.com",
            subject="Test",
            status=EmailStatus.SENT.value,
            purpose=EmailPurpose.TRANSACTIONAL.value,
            sendgrid_message_id="abc123",
        )

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = email_log
        mock_db.execute.return_value = mock_result

        # Also mock get_or_create_consent for bounce tracking
        consent = EmailConsent(
            id=uuid.uuid4(),
            email="invalid@example.com",
            hard_bounced=False,
            bounce_count=0,
        )
        mock_consent_result = MagicMock()
        mock_consent_result.scalar_one_or_none.return_value = consent

        # Set up execute to return different results for different queries
        mock_db.execute.side_effect = [mock_result, mock_consent_result]

        event = {
            "event": "bounce",
            "type": "bounce",  # Hard bounce
            "sg_message_id": "abc123",
            "timestamp": 1707734400,
            "reason": "Invalid email address",
            "status": "5.1.1",
        }

        result = await service.process_sendgrid_event(event)

        assert result is True
        assert email_log.status == EmailStatus.BOUNCED.value
        assert email_log.bounced_at is not None
        assert email_log.error_message == "Invalid email address"

    @pytest.mark.asyncio
    async def test_process_event_no_matching_log(self, service, mock_db):
        """Test processing event with no matching log."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        event = {
            "event": "delivered",
            "sg_message_id": "nonexistent123",
            "timestamp": 1707734400,
        }

        result = await service.process_sendgrid_event(event)

        assert result is False

    @pytest.mark.asyncio
    async def test_process_event_no_message_id(self, service, mock_db):
        """Test processing event without message ID."""
        event = {
            "event": "delivered",
            "timestamp": 1707734400,
        }

        result = await service.process_sendgrid_event(event)

        assert result is False


class TestConsentManagement:
    """Test email consent management."""

    @pytest.fixture
    def mock_db(self):
        """Create mock async database session."""
        db = AsyncMock(spec=AsyncSession)
        db.add = MagicMock()
        db.flush = AsyncMock()
        return db

    @pytest.fixture
    def service(self, mock_db):
        """Create EmailAuditService with mock DB."""
        return EmailAuditService(mock_db)

    @pytest.mark.asyncio
    async def test_can_send_transactional_no_suppression(self, service, mock_db):
        """Test sending transactional email to unsuppressed address."""
        consent = EmailConsent(
            id=uuid.uuid4(),
            email="test@example.com",
            hard_bounced=False,
            spam_reported=False,
            unsubscribed=False,
            marketing_consent=False,
        )

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = consent
        mock_db.execute.return_value = mock_result

        can_send, reason = await service.can_send_email(
            "test@example.com", EmailPurpose.TRANSACTIONAL
        )

        assert can_send is True
        assert reason == "ok"

    @pytest.mark.asyncio
    async def test_can_send_blocked_by_hard_bounce(self, service, mock_db):
        """Test blocking email to hard bounced address."""
        consent = EmailConsent(
            id=uuid.uuid4(),
            email="bounced@example.com",
            hard_bounced=True,
            spam_reported=False,
            unsubscribed=False,
        )

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = consent
        mock_db.execute.return_value = mock_result

        can_send, reason = await service.can_send_email(
            "bounced@example.com", EmailPurpose.TRANSACTIONAL
        )

        assert can_send is False
        assert reason == "hard_bounced"

    @pytest.mark.asyncio
    async def test_can_send_marketing_without_consent(self, service, mock_db):
        """Test blocking marketing email without consent."""
        consent = EmailConsent(
            id=uuid.uuid4(),
            email="test@example.com",
            hard_bounced=False,
            spam_reported=False,
            unsubscribed=False,
            marketing_consent=False,
        )

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = consent
        mock_db.execute.return_value = mock_result

        can_send, reason = await service.can_send_email(
            "test@example.com", EmailPurpose.MARKETING
        )

        assert can_send is False
        assert reason == "no_marketing_consent"

    @pytest.mark.asyncio
    async def test_can_send_marketing_with_consent(self, service, mock_db):
        """Test allowing marketing email with consent."""
        consent = EmailConsent(
            id=uuid.uuid4(),
            email="test@example.com",
            hard_bounced=False,
            spam_reported=False,
            unsubscribed=False,
            marketing_consent=True,
        )

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = consent
        mock_db.execute.return_value = mock_result

        can_send, reason = await service.can_send_email(
            "test@example.com", EmailPurpose.MARKETING
        )

        assert can_send is True
        assert reason == "ok"

    @pytest.mark.asyncio
    async def test_can_send_marketing_unsubscribed(self, service, mock_db):
        """Test blocking marketing email to unsubscribed address."""
        consent = EmailConsent(
            id=uuid.uuid4(),
            email="test@example.com",
            hard_bounced=False,
            spam_reported=False,
            unsubscribed=True,
            marketing_consent=True,  # Even with consent
        )

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = consent
        mock_db.execute.return_value = mock_result

        can_send, reason = await service.can_send_email(
            "test@example.com", EmailPurpose.MARKETING
        )

        assert can_send is False
        assert reason == "unsubscribed"


class TestGDPRExport:
    """Test GDPR data export functionality."""

    @pytest.fixture
    def mock_db(self):
        """Create mock async database session."""
        db = AsyncMock(spec=AsyncSession)
        return db

    @pytest.fixture
    def service(self, mock_db):
        """Create EmailAuditService with mock DB."""
        return EmailAuditService(mock_db)

    @pytest.mark.asyncio
    async def test_gdpr_export_by_email(self, service, mock_db):
        """Test GDPR export by email address."""
        email_logs = [
            EmailLog(
                id=uuid.uuid4(),
                recipient_email="user@example.com",
                from_email="noreply@ccw.com",
                subject="Welcome",
                status=EmailStatus.DELIVERED.value,
                purpose=EmailPurpose.TRANSACTIONAL.value,
                sent_at=datetime.now(UTC),
                content_purged=False,
            ),
            EmailLog(
                id=uuid.uuid4(),
                recipient_email="user@example.com",
                from_email="noreply@ccw.com",
                subject="Order Confirmation",
                status=EmailStatus.OPENED.value,
                purpose=EmailPurpose.TRANSACTIONAL.value,
                sent_at=datetime.now(UTC),
                content_purged=False,
            ),
        ]

        consent = EmailConsent(
            id=uuid.uuid4(),
            email="user@example.com",
            marketing_consent=True,
            marketing_consent_at=datetime.now(UTC),
            unsubscribed=False,
        )

        # Mock email logs query
        mock_email_result = MagicMock()
        mock_email_scalars = MagicMock()
        mock_email_scalars.all.return_value = email_logs
        mock_email_result.scalars.return_value = mock_email_scalars

        # Mock consent query
        mock_consent_result = MagicMock()
        mock_consent_result.scalar_one_or_none.return_value = consent

        mock_db.execute.side_effect = [mock_email_result, mock_consent_result]

        result = await service.get_gdpr_export(email="user@example.com")

        assert result["export_type"] == "gdpr_data_portability"
        assert result["email_address"] == "user@example.com"
        assert result["total_emails"] == 2
        assert len(result["emails"]) == 2
        assert result["consent_status"]["marketing_consent"] is True

    @pytest.mark.asyncio
    async def test_gdpr_export_requires_email_or_customer(self, service):
        """Test GDPR export requires either email or customer_id."""
        with pytest.raises(ValueError, match="Either email or customer_id must be provided"):
            await service.get_gdpr_export()
