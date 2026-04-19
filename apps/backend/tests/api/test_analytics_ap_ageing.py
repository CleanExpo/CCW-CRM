"""Tests for the AP Ageing report logic (UNI-1834).

Standalone tests for the bucket-classification helper. Route-integration
tests are a follow-up once the shared conftest is restored.
"""

import pytest


@pytest.mark.parametrize(
    "age_days, expected",
    [
        (0, "0-30"),
        (1, "0-30"),
        (30, "0-30"),
        (31, "31-60"),
        (45, "31-60"),
        (60, "31-60"),
        (61, "61-90"),
        (75, "61-90"),
        (90, "61-90"),
        (91, "90+"),
        (180, "90+"),
        (365, "90+"),
        (-5, "0-30"),  # future-dated PO — shouldn't crash; folds into 0-30
    ],
)
def test_classify_ap_age_bucket_boundaries(age_days, expected):
    """The bucket helper returns correct labels at + across every boundary."""
    from src.api.routes.analytics import classify_ap_age_bucket

    assert classify_ap_age_bucket(age_days) == expected


def test_ap_ageing_buckets_order():
    """Public tuple of bucket labels is in the expected CFO-report order
    so the frontend can zip it with its column headers without sorting."""
    from src.api.routes.analytics import AP_AGEING_BUCKETS

    assert AP_AGEING_BUCKETS == ("0-30", "31-60", "61-90", "90+")


def test_classify_returns_one_of_the_public_buckets():
    """Every output of classify_ap_age_bucket is a member of AP_AGEING_BUCKETS."""
    from src.api.routes.analytics import AP_AGEING_BUCKETS, classify_ap_age_bucket

    for days in (-100, -1, 0, 15, 30, 31, 60, 61, 90, 91, 1000):
        assert classify_ap_age_bucket(days) in AP_AGEING_BUCKETS
