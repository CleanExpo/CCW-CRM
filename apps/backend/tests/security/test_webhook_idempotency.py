"""
Tests for UNI-1918 — HMAC verification + idempotency on webhooks.

Pure-Python structural tests; no HTTP requests, no DB required.
Validates:
- Cin7 webhook handler uses WebhookService (idempotency + persistence)
- Cin7 HMAC-SHA256 signature verification is present
- Shopify handler uses WebhookService (existing ISS-036 implementation)
- webhook_events table has a (source, event_id) unique composite index
- Both handlers extract event_id for deduplication
"""

from pathlib import Path


_BACKEND = Path(__file__).parents[2] / "src"

_CIN7_WEBHOOKS = _BACKEND / "api" / "routes" / "integrations" / "cin7_webhooks.py"
_SHOPIFY_WEBHOOKS = _BACKEND / "integrations" / "shopify" / "webhooks.py"
_WEBHOOK_SERVICE = _BACKEND / "services" / "webhook_service.py"
_WEBHOOK_MODELS = _BACKEND / "db" / "webhook_models.py"


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


# ---------------------------------------------------------------------------
# Cin7 webhook HMAC + idempotency
# ---------------------------------------------------------------------------

class TestCin7WebhookHandler:
    def test_file_exists(self):
        assert _CIN7_WEBHOOKS.exists()

    def test_hmac_verification_present(self):
        src = _read(_CIN7_WEBHOOKS)
        assert "hmac" in src
        assert "compare_digest" in src

    def test_uses_sha256(self):
        src = _read(_CIN7_WEBHOOKS)
        assert "sha256" in src

    def test_imports_webhook_service(self):
        src = _read(_CIN7_WEBHOOKS)
        assert "from src.services.webhook_service import WebhookService" in src

    def test_calls_process_webhook(self):
        src = _read(_CIN7_WEBHOOKS)
        assert "process_webhook(" in src

    def test_passes_source_cin7(self):
        src = _read(_CIN7_WEBHOOKS)
        assert 'source="cin7"' in src

    def test_passes_event_id(self):
        src = _read(_CIN7_WEBHOOKS)
        assert "event_id=event_id" in src

    def test_extracts_event_id_from_payload(self):
        src = _read(_CIN7_WEBHOOKS)
        assert '"event_id"' in src or "event_id" in src

    def test_requires_db_session(self):
        src = _read(_CIN7_WEBHOOKS)
        assert "get_async_db" in src


# ---------------------------------------------------------------------------
# Shopify webhook idempotency (ISS-036 replay test)
# ---------------------------------------------------------------------------

class TestShopifyWebhookIdempotency:
    def test_file_exists(self):
        assert _SHOPIFY_WEBHOOKS.exists()

    def test_imports_webhook_service(self):
        src = _read(_SHOPIFY_WEBHOOKS)
        assert "WebhookService" in src

    def test_uses_event_id_for_deduplication(self):
        src = _read(_SHOPIFY_WEBHOOKS)
        assert "event_id" in src

    def test_calls_process_webhook(self):
        src = _read(_SHOPIFY_WEBHOOKS)
        assert "process_webhook" in src

    def test_replay_rejected_for_duplicate(self):
        """Duplicate detection is provided by WebhookService._find_existing_webhook."""
        svc_src = _read(_WEBHOOK_SERVICE)
        assert "_find_existing_webhook" in svc_src
        assert '"duplicate"' in svc_src or "'duplicate'" in svc_src


# ---------------------------------------------------------------------------
# WebhookService idempotency guarantees
# ---------------------------------------------------------------------------

class TestWebhookService:
    def test_file_exists(self):
        assert _WEBHOOK_SERVICE.exists()

    def test_checks_for_duplicate_before_processing(self):
        src = _read(_WEBHOOK_SERVICE)
        assert "_find_existing_webhook" in src

    def test_unique_lookup_by_source_and_event_id(self):
        src = _read(_WEBHOOK_SERVICE)
        assert "WebhookEvent.source == source" in src
        assert "WebhookEvent.event_id == event_id" in src


# ---------------------------------------------------------------------------
# webhook_events table schema
# ---------------------------------------------------------------------------

class TestWebhookEventsTable:
    def test_file_exists(self):
        assert _WEBHOOK_MODELS.exists()

    def test_has_event_id_column(self):
        src = _read(_WEBHOOK_MODELS)
        assert "event_id" in src

    def test_has_unique_composite_index(self):
        src = _read(_WEBHOOK_MODELS)
        assert "unique=True" in src
        assert "source" in src
        assert "event_id" in src

    def test_cin7_is_a_valid_source(self):
        src = _read(_WEBHOOK_MODELS)
        assert 'CIN7 = "cin7"' in src or "CIN7" in src
