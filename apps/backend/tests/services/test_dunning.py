"""Tests for dunning letter automation service (GAP-029)."""
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from src.services.dunning import (
    DunningLevel,
    calculate_days_overdue,
    generate_dunning_letter,
    get_dunning_level,
    get_dunning_schedule,
    should_send_dunning_pure,
)


class TestGetDunningLevel:
    """Test dunning level determination."""

    def test_level_1_friendly_reminder(self):
        """Test level 1 at 7 days overdue."""
        assert get_dunning_level(7) == DunningLevel.FRIENDLY_REMINDER
        assert get_dunning_level(10) == DunningLevel.FRIENDLY_REMINDER
        assert get_dunning_level(13) == DunningLevel.FRIENDLY_REMINDER

    def test_level_2_formal_notice(self):
        """Test level 2 at 14+ days overdue."""
        assert get_dunning_level(14) == DunningLevel.FORMAL_NOTICE
        assert get_dunning_level(20) == DunningLevel.FORMAL_NOTICE
        assert get_dunning_level(29) == DunningLevel.FORMAL_NOTICE

    def test_level_3_final_warning(self):
        """Test level 3 at 30+ days overdue."""
        assert get_dunning_level(30) == DunningLevel.FINAL_WARNING
        assert get_dunning_level(35) == DunningLevel.FINAL_WARNING
        assert get_dunning_level(44) == DunningLevel.FINAL_WARNING

    def test_level_4_collections(self):
        """Test level 4 at 45+ days overdue."""
        assert get_dunning_level(45) == DunningLevel.COLLECTIONS
        assert get_dunning_level(60) == DunningLevel.COLLECTIONS
        assert get_dunning_level(100) == DunningLevel.COLLECTIONS

    def test_not_overdue_enough(self):
        """Test days below threshold default to level 1."""
        assert get_dunning_level(0) == DunningLevel.FRIENDLY_REMINDER
        assert get_dunning_level(5) == DunningLevel.FRIENDLY_REMINDER


class TestCalculateDaysOverdue:
    """Test days overdue calculation."""

    def test_past_due(self):
        """Test invoice past due date."""
        due_date = date(2024, 1, 1)
        reference_date = date(2024, 1, 10)

        days = calculate_days_overdue(due_date, reference_date)

        assert days == 9

    def test_not_yet_due(self):
        """Test invoice not yet due."""
        due_date = date(2024, 1, 10)
        reference_date = date(2024, 1, 5)

        days = calculate_days_overdue(due_date, reference_date)

        assert days == -5  # Negative means not yet due

    def test_due_today(self):
        """Test invoice due today."""
        today = date.today()

        days = calculate_days_overdue(today, today)

        assert days == 0

    def test_default_reference_date(self):
        """Test defaults to today if reference_date not provided."""
        due_date = date.today() - timedelta(days=7)

        days = calculate_days_overdue(due_date)

        assert days >= 7  # Should be at least 7 days


class TestGenerateDunningLetter:
    """Test dunning letter generation."""

    def test_level_1_friendly_tone(self):
        """Test level 1 letter has friendly tone."""
        letter = generate_dunning_letter(
            invoice_number="INV-001",
            customer_name="Test Customer",
            amount_due=Decimal("500.00"),
            due_date=date(2024, 1, 1),
            level=DunningLevel.FRIENDLY_REMINDER,
            reference_date=date(2024, 1, 10),
        )

        assert letter.level == DunningLevel.FRIENDLY_REMINDER
        assert letter.tone == "friendly"
        assert "Friendly Reminder" in letter.subject
        assert "Test Customer" in letter.body
        assert "INV-001" in letter.body
        assert letter.days_overdue == 9
        assert letter.amount_due == Decimal("500.00")

    def test_level_2_formal_tone(self):
        """Test level 2 letter has formal tone."""
        letter = generate_dunning_letter(
            invoice_number="INV-002",
            customer_name="Test Corp",
            amount_due=Decimal("1000.00"),
            due_date=date(2024, 1, 1),
            level=DunningLevel.FORMAL_NOTICE,
            reference_date=date(2024, 1, 20),
        )

        assert letter.tone == "formal"
        assert "Payment Required" in letter.subject
        assert "19 Days Overdue" in letter.subject or "19 days overdue" in letter.subject
        assert "19" in letter.body

    def test_level_3_urgent_tone(self):
        """Test level 3 letter has urgent tone."""
        letter = generate_dunning_letter(
            invoice_number="INV-003",
            customer_name="Urgent Inc",
            amount_due=Decimal("2000.00"),
            due_date=date(2024, 1, 1),
            level=DunningLevel.FINAL_WARNING,
            reference_date=date(2024, 2, 5),
        )

        assert letter.tone == "urgent"
        assert "FINAL NOTICE" in letter.subject
        assert "URGENT" in letter.body
        assert letter.days_overdue == 35

    def test_level_4_severe_tone(self):
        """Test level 4 letter has severe tone."""
        letter = generate_dunning_letter(
            invoice_number="INV-004",
            customer_name="Collections Co",
            amount_due=Decimal("5000.00"),
            due_date=date(2024, 1, 1),
            level=DunningLevel.COLLECTIONS,
            reference_date=date(2024, 3, 1),
        )

        assert letter.tone == "severe"
        assert "COLLECTIONS NOTICE" in letter.subject
        assert "collections department" in letter.body
        assert letter.days_overdue == 60

    def test_all_placeholders_populated(self):
        """Test all placeholders are populated in letter."""
        letter = generate_dunning_letter(
            invoice_number="INV-TEST",
            customer_name="Placeholder Test",
            amount_due=Decimal("123.45"),
            due_date=date(2024, 1, 15),
            level=DunningLevel.FORMAL_NOTICE,
            reference_date=date(2024, 2, 1),
        )

        assert "INV-TEST" in letter.body
        assert "Placeholder Test" in letter.body
        assert "123.45" in letter.body
        assert "2024-01-15" in letter.body


class TestShouldSendDunningPure:
    """Test dunning send decision logic."""

    def test_should_send_when_overdue(self):
        """Test should send when 7+ days overdue."""
        due_date = date(2024, 1, 1)
        reference_date = date(2024, 1, 10)  # 9 days overdue

        check = should_send_dunning_pure(
            due_date=due_date,
            last_dunning_sent=None,
            amount_due=Decimal("100.00"),
            reference_date=reference_date,
        )

        assert check.should_send is True
        assert check.level == DunningLevel.FRIENDLY_REMINDER
        assert check.days_overdue == 9

    def test_should_not_send_not_overdue_enough(self):
        """Test should not send when only 3 days overdue."""
        due_date = date(2024, 1, 1)
        reference_date = date(2024, 1, 4)  # 3 days overdue

        check = should_send_dunning_pure(
            due_date=due_date,
            last_dunning_sent=None,
            amount_due=Decimal("100.00"),
            reference_date=reference_date,
        )

        assert check.should_send is False
        assert "Not yet due" in check.reason

    def test_should_not_send_already_paid(self):
        """Test should not send when invoice is paid."""
        due_date = date(2024, 1, 1)
        reference_date = date(2024, 1, 10)

        check = should_send_dunning_pure(
            due_date=due_date,
            last_dunning_sent=None,
            amount_due=Decimal("0.00"),  # Already paid
            reference_date=reference_date,
        )

        assert check.should_send is False
        assert "already paid" in check.reason.lower()

    def test_should_not_send_already_sent_today(self):
        """Test should not send if already sent today."""
        due_date = date(2024, 1, 1)
        reference_date = date(2024, 1, 10)
        last_sent = datetime(2024, 1, 10, 8, 0, 0, tzinfo=UTC)  # Sent this morning

        check = should_send_dunning_pure(
            due_date=due_date,
            last_dunning_sent=last_sent,
            amount_due=Decimal("100.00"),
            reference_date=reference_date,
        )

        assert check.should_send is False
        assert "already sent today" in check.reason.lower()

    def test_should_send_if_sent_yesterday(self):
        """Test should send if last sent was yesterday (escalation)."""
        due_date = date(2024, 1, 1)
        reference_date = date(2024, 1, 20)  # 19 days overdue
        last_sent = datetime(2024, 1, 19, 10, 0, 0, tzinfo=UTC)  # Sent yesterday

        check = should_send_dunning_pure(
            due_date=due_date,
            last_dunning_sent=last_sent,
            amount_due=Decimal("100.00"),
            reference_date=reference_date,
        )

        assert check.should_send is True
        assert check.level == DunningLevel.FORMAL_NOTICE


class TestGetDunningSchedule:
    """Test dunning schedule retrieval."""

    def test_schedule_has_all_levels(self):
        """Test schedule includes all escalation levels."""
        schedule = get_dunning_schedule()

        assert 7 in schedule  # Level 1
        assert 14 in schedule  # Level 2
        assert 30 in schedule  # Level 3
        assert 45 in schedule  # Level 4

    def test_schedule_has_descriptions(self):
        """Test each level has description."""
        schedule = get_dunning_schedule()

        for days, action in schedule.items():
            assert len(action) > 0
            assert isinstance(action, str)
