"""Tests for SLA escalation service (GAP-031)."""
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from src.services.sla_escalation import (
    EscalationLevel,
    Organization,
    Task,
    User,
    build_escalation_message,
    calculate_escalation_level,
    calculate_hours_overdue,
    get_escalation_assignee,
    is_sla_breached,
    should_escalate,
)


class TestIsSlaBreached:
    """Test SLA breach detection."""

    def test_breached_past_deadline(self):
        """Test SLA is breached when past deadline."""
        deadline = datetime(2024, 1, 1, 12, 0, 0, tzinfo=UTC)
        current_time = datetime(2024, 1, 1, 13, 0, 0, tzinfo=UTC)

        assert is_sla_breached(deadline, current_time) is True

    def test_not_breached_before_deadline(self):
        """Test SLA not breached when before deadline."""
        deadline = datetime(2024, 1, 1, 12, 0, 0, tzinfo=UTC)
        current_time = datetime(2024, 1, 1, 11, 0, 0, tzinfo=UTC)

        assert is_sla_breached(deadline, current_time) is False

    def test_not_breached_exactly_at_deadline(self):
        """Test SLA not breached exactly at deadline."""
        deadline = datetime(2024, 1, 1, 12, 0, 0, tzinfo=UTC)
        current_time = datetime(2024, 1, 1, 12, 0, 0, tzinfo=UTC)

        assert is_sla_breached(deadline, current_time) is False


class TestCalculateHoursOverdue:
    """Test hours overdue calculation."""

    def test_1_hour_overdue(self):
        """Test 1 hour overdue."""
        deadline = datetime(2024, 1, 1, 12, 0, 0, tzinfo=UTC)
        current_time = datetime(2024, 1, 1, 13, 0, 0, tzinfo=UTC)

        hours = calculate_hours_overdue(deadline, current_time)

        assert hours == 1.0

    def test_24_hours_overdue(self):
        """Test 24 hours overdue."""
        deadline = datetime(2024, 1, 1, 12, 0, 0, tzinfo=UTC)
        current_time = datetime(2024, 1, 2, 12, 0, 0, tzinfo=UTC)

        hours = calculate_hours_overdue(deadline, current_time)

        assert hours == 24.0

    def test_negative_hours_not_yet_due(self):
        """Test negative hours when not yet due."""
        deadline = datetime(2024, 1, 1, 12, 0, 0, tzinfo=UTC)
        current_time = datetime(2024, 1, 1, 10, 0, 0, tzinfo=UTC)

        hours = calculate_hours_overdue(deadline, current_time)

        assert hours == -2.0

    def test_fractional_hours(self):
        """Test calculation with fractional hours."""
        deadline = datetime(2024, 1, 1, 12, 0, 0, tzinfo=UTC)
        current_time = datetime(2024, 1, 1, 12, 30, 0, tzinfo=UTC)

        hours = calculate_hours_overdue(deadline, current_time)

        assert hours == 0.5


class TestCalculateEscalationLevel:
    """Test escalation level calculation."""

    def test_level_1_under_24_hours(self):
        """Test level 1 for 0-24 hours overdue."""
        assert calculate_escalation_level(1.0) == EscalationLevel.LEVEL_1
        assert calculate_escalation_level(12.0) == EscalationLevel.LEVEL_1
        assert calculate_escalation_level(23.9) == EscalationLevel.LEVEL_1

    def test_level_2_24_to_72_hours(self):
        """Test level 2 for 24-72 hours overdue."""
        assert calculate_escalation_level(24.0) == EscalationLevel.LEVEL_2
        assert calculate_escalation_level(48.0) == EscalationLevel.LEVEL_2
        assert calculate_escalation_level(71.9) == EscalationLevel.LEVEL_2

    def test_level_3_over_72_hours(self):
        """Test level 3 for 72+ hours overdue."""
        assert calculate_escalation_level(72.0) == EscalationLevel.LEVEL_3
        assert calculate_escalation_level(100.0) == EscalationLevel.LEVEL_3
        assert calculate_escalation_level(200.0) == EscalationLevel.LEVEL_3

    def test_edge_case_exactly_24_hours(self):
        """Test exactly 24 hours is level 2."""
        assert calculate_escalation_level(24.0) == EscalationLevel.LEVEL_2

    def test_edge_case_exactly_72_hours(self):
        """Test exactly 72 hours is level 3."""
        assert calculate_escalation_level(72.0) == EscalationLevel.LEVEL_3


class TestGetEscalationAssignee:
    """Test escalation assignee selection."""

    def test_level_1_finds_manager(self):
        """Test level 1 finds manager for notification."""
        manager_id = uuid4()
        staff_id = uuid4()

        users = [
            User(
                user_id=staff_id,
                name="Staff Member",
                email="staff@test.com",
                role="staff",
                manager_id=manager_id,
            ),
            User(
                user_id=manager_id,
                name="Manager",
                email="manager@test.com",
                role="manager",
                manager_id=None,
            ),
        ]

        org = Organization(org_id=uuid4(), name="Test Org", users=users)

        task = Task(
            task_id=uuid4(),
            entity_type="order",
            entity_id=uuid4(),
            assigned_to=staff_id,
            deadline=datetime.now(UTC),
            current_assignee_role="staff",
        )

        assignee = get_escalation_assignee(task, EscalationLevel.LEVEL_1, org)

        assert assignee is not None
        assert assignee.user_id == manager_id

    def test_level_2_finds_senior(self):
        """Test level 2 finds senior team member."""
        staff_id = uuid4()
        senior_id = uuid4()

        users = [
            User(
                user_id=staff_id,
                name="Staff",
                email="staff@test.com",
                role="staff",
                manager_id=None,
            ),
            User(
                user_id=senior_id,
                name="Senior",
                email="senior@test.com",
                role="senior",
                manager_id=None,
            ),
        ]

        org = Organization(org_id=uuid4(), name="Test Org", users=users)

        task = Task(
            task_id=uuid4(),
            entity_type="order",
            entity_id=uuid4(),
            assigned_to=staff_id,
            deadline=datetime.now(UTC),
            current_assignee_role="staff",
        )

        assignee = get_escalation_assignee(task, EscalationLevel.LEVEL_2, org)

        assert assignee is not None
        assert assignee.role in ["senior", "lead"]

    def test_level_3_finds_department_head(self):
        """Test level 3 finds department head."""
        users = [
            User(
                user_id=uuid4(),
                name="Staff",
                email="staff@test.com",
                role="staff",
                manager_id=None,
            ),
            User(
                user_id=uuid4(),
                name="Director",
                email="director@test.com",
                role="director",
                manager_id=None,
            ),
        ]

        org = Organization(org_id=uuid4(), name="Test Org", users=users)

        task = Task(
            task_id=uuid4(),
            entity_type="order",
            entity_id=uuid4(),
            assigned_to=users[0].user_id,
            deadline=datetime.now(UTC),
            current_assignee_role="staff",
        )

        assignee = get_escalation_assignee(task, EscalationLevel.LEVEL_3, org)

        assert assignee is not None
        assert assignee.role in ["lead", "director", "head"]

    def test_no_assignee_when_no_suitable_user(self):
        """Test returns None when no suitable user found."""
        users = [
            User(
                user_id=uuid4(),
                name="Staff Only",
                email="staff@test.com",
                role="staff",
                manager_id=None,
            ),
        ]

        org = Organization(org_id=uuid4(), name="Test Org", users=users)

        task = Task(
            task_id=uuid4(),
            entity_type="order",
            entity_id=uuid4(),
            assigned_to=users[0].user_id,
            deadline=datetime.now(UTC),
            current_assignee_role="staff",
        )

        assignee = get_escalation_assignee(task, EscalationLevel.LEVEL_3, org)

        assert assignee is None

    def test_unassigned_task_finds_appropriate_role(self):
        """Test finds appropriate role for unassigned task."""
        users = [
            User(
                user_id=uuid4(),
                name="Manager",
                email="manager@test.com",
                role="manager",
                manager_id=None,
            ),
        ]

        org = Organization(org_id=uuid4(), name="Test Org", users=users)

        task = Task(
            task_id=uuid4(),
            entity_type="order",
            entity_id=uuid4(),
            assigned_to=None,  # Unassigned
            deadline=datetime.now(UTC),
            current_assignee_role="staff",
        )

        assignee = get_escalation_assignee(task, EscalationLevel.LEVEL_1, org)

        assert assignee is not None
        assert assignee.role in ["manager", "senior", "lead"]


class TestBuildEscalationMessage:
    """Test escalation message building."""

    def test_level_1_message(self):
        """Test level 1 message has appropriate content."""
        task = Task(
            task_id=uuid4(),
            entity_type="order",
            entity_id=uuid4(),
            assigned_to=uuid4(),
            deadline=datetime(2024, 1, 1, 12, 0, 0, tzinfo=UTC),
            current_assignee_role="staff",
        )

        assignee = User(
            user_id=uuid4(),
            name="Manager",
            email="manager@test.com",
            role="manager",
            manager_id=None,
        )

        message = build_escalation_message(task, EscalationLevel.LEVEL_1, 10.0, assignee)

        assert "SLA Breach Notification" in message["subject"]
        assert "Level 1" in message["body"]
        assert "Manager" in message["body"]
        assert "10.0" in message["body"]

    def test_level_2_message_urgent(self):
        """Test level 2 message has URGENT marker."""
        task = Task(
            task_id=uuid4(),
            entity_type="order",
            entity_id=uuid4(),
            assigned_to=uuid4(),
            deadline=datetime(2024, 1, 1, 12, 0, 0, tzinfo=UTC),
            current_assignee_role="staff",
        )

        message = build_escalation_message(task, EscalationLevel.LEVEL_2, 48.0, None)

        assert "URGENT" in message["subject"]
        assert "Reassignment" in message["subject"]
        assert "48.0" in message["body"]

    def test_level_3_message_critical(self):
        """Test level 3 message has CRITICAL marker."""
        task = Task(
            task_id=uuid4(),
            entity_type="order",
            entity_id=uuid4(),
            assigned_to=uuid4(),
            deadline=datetime(2024, 1, 1, 12, 0, 0, tzinfo=UTC),
            current_assignee_role="staff",
        )

        message = build_escalation_message(task, EscalationLevel.LEVEL_3, 100.0, None)

        assert "CRITICAL" in message["subject"]
        assert "Department Head" in message["subject"]
        assert "100.0" in message["body"]


class TestShouldEscalate:
    """Test escalation decision logic."""

    def test_should_escalate_when_breached(self):
        """Test should escalate when SLA breached."""
        deadline = datetime.now(UTC) - timedelta(hours=10)

        should, reason = should_escalate(
            deadline=deadline,
            last_escalation_time=None,
        )

        assert should is True
        assert "breached" in reason.lower()

    def test_should_not_escalate_not_breached(self):
        """Test should not escalate when SLA not breached."""
        deadline = datetime.now(UTC) + timedelta(hours=5)

        should, reason = should_escalate(
            deadline=deadline,
            last_escalation_time=None,
        )

        assert should is False
        assert "not yet breached" in reason.lower()

    def test_should_not_escalate_just_escalated(self):
        """Test should not escalate if already escalated recently."""
        deadline = datetime.now(UTC) - timedelta(hours=10)
        last_escalation = datetime.now(UTC) - timedelta(minutes=30)

        should, reason = should_escalate(
            deadline=deadline,
            last_escalation_time=last_escalation,
        )

        assert should is False
        assert "already escalated" in reason.lower()

    def test_should_escalate_if_escalated_2_hours_ago(self):
        """Test should re-escalate if last escalation was 2 hours ago."""
        deadline = datetime.now(UTC) - timedelta(hours=10)
        last_escalation = datetime.now(UTC) - timedelta(hours=2)

        should, reason = should_escalate(
            deadline=deadline,
            last_escalation_time=last_escalation,
        )

        assert should is True
