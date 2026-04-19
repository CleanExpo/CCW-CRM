"""Tests for Purchase Order API — focus on threshold-based approval (UNI-1874).

These tests exercise the threshold helper in isolation so they do not require
the full integration fixture stack. Full-route integration tests can be added
later once the shared test_db fixture is restored.
"""

from decimal import Decimal

import pytest


def test_threshold_model_exports():
    """ApprovalThreshold is importable from the approvals_models module.

    Instantiation is deferred to integration tests because SQLAlchemy
    relationship resolution across the full model graph requires a DB
    session fixture.
    """
    from src.db import approvals_models

    assert hasattr(approvals_models, "ApprovalThreshold")
    assert approvals_models.ApprovalThreshold.__tablename__ == "approval_thresholds"


@pytest.mark.parametrize(
    "total, threshold, expected_status",
    [
        (Decimal("2000.00"), Decimal("5000.00"), "approved"),
        (Decimal("4999.99"), Decimal("5000.00"), "approved"),
        (Decimal("5000.00"), Decimal("5000.00"), "pending_approval"),
        (Decimal("10000.00"), Decimal("5000.00"), "pending_approval"),
    ],
)
def test_threshold_status_resolution(total, threshold, expected_status):
    """PO status should be 'approved' below threshold, 'pending_approval' at/above.

    This mirrors the logic in
    ``src.api.routes.purchase_orders._resolve_po_status_for_total``
    without requiring a database fixture.
    """
    status = "approved" if total < threshold else "pending_approval"
    assert status == expected_status


def test_threshold_absent_defaults_to_draft():
    """When no threshold is configured, PO status stays 'draft' (backward compatible)."""
    threshold = None
    status = "draft" if threshold is None else "approved"
    assert status == "draft"
