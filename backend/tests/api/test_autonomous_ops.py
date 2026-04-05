"""Integration tests for Sprint 3 Autonomous Ops endpoints.

Tests:
  POST /api/ai/autonomous/run   — trigger manual ops run
  GET  /api/ai/autonomous/log   — audit trail
  GET  /api/ai/autonomous/health — health check

All tests run in demo mode (no ANTHROPIC_API_KEY required).
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
class TestAutonomousOpsRun:
    """Tests for POST /api/ai/autonomous/run."""

    async def test_run_returns_200(self, client: AsyncClient, auth_headers: dict):
        resp = await client.post(
            "/api/ai/autonomous/run",
            json={"trigger": "manual", "dry_run": True},
            headers=auth_headers,
        )
        assert resp.status_code == 200

    async def test_run_response_has_required_fields(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.post(
            "/api/ai/autonomous/run",
            json={"trigger": "manual", "dry_run": True},
            headers=auth_headers,
        )
        body = resp.json()
        for field in ("run_id", "trigger", "model", "started_at", "completed_at",
                      "actions_evaluated", "actions_taken", "actions", "summary"):
            assert field in body, f"Missing field: {field}"

    async def test_run_returns_actions_list(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.post(
            "/api/ai/autonomous/run",
            json={"trigger": "manual", "dry_run": True},
            headers=auth_headers,
        )
        body = resp.json()
        assert isinstance(body["actions"], list)
        assert body["actions_taken"] == len(body["actions"])

    async def test_each_action_has_required_fields(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.post(
            "/api/ai/autonomous/run",
            json={"trigger": "manual", "dry_run": True},
            headers=auth_headers,
        )
        body = resp.json()
        assert body["actions"], "Expected at least one action in demo mode"
        for action in body["actions"]:
            for field in ("action_id", "action_type", "entity_type", "entity_id",
                          "description", "confidence", "status", "created_at"):
                assert field in action, f"Action missing field: {field}"

    async def test_action_confidence_in_range(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.post(
            "/api/ai/autonomous/run",
            json={"trigger": "manual", "dry_run": True},
            headers=auth_headers,
        )
        body = resp.json()
        for action in body["actions"]:
            assert 0.0 <= action["confidence"] <= 1.0, (
                f"Confidence out of range: {action['confidence']}"
            )

    async def test_demo_mode_includes_po_action(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.post(
            "/api/ai/autonomous/run",
            json={"trigger": "manual", "dry_run": True},
            headers=auth_headers,
        )
        body = resp.json()
        action_types = [a["action_type"] for a in body["actions"]]
        assert "create_draft_purchase_order" in action_types

    async def test_demo_mode_includes_payment_reminder(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.post(
            "/api/ai/autonomous/run",
            json={"trigger": "manual", "dry_run": True},
            headers=auth_headers,
        )
        body = resp.json()
        action_types = [a["action_type"] for a in body["actions"]]
        assert "send_payment_reminder" in action_types

    async def test_trigger_field_preserved(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.post(
            "/api/ai/autonomous/run",
            json={"trigger": "scheduled_hourly", "dry_run": True},
            headers=auth_headers,
        )
        body = resp.json()
        assert body["trigger"] == "scheduled_hourly"

    async def test_model_field_present(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.post(
            "/api/ai/autonomous/run",
            json={"trigger": "manual", "dry_run": True},
            headers=auth_headers,
        )
        body = resp.json()
        assert "claude" in body["model"].lower()


@pytest.mark.asyncio
class TestAutonomousOpsLog:
    """Tests for GET /api/ai/autonomous/log."""

    async def _seed_run(self, client: AsyncClient, auth_headers: dict) -> None:
        """Ensure at least one run exists in the log."""
        await client.post(
            "/api/ai/autonomous/run",
            json={"trigger": "manual", "dry_run": True},
            headers=auth_headers,
        )

    async def test_log_returns_200(self, client: AsyncClient, auth_headers: dict):
        await self._seed_run(client, auth_headers)
        resp = await client.get("/api/ai/autonomous/log", headers=auth_headers)
        assert resp.status_code == 200

    async def test_log_response_shape(self, client: AsyncClient, auth_headers: dict):
        await self._seed_run(client, auth_headers)
        resp = await client.get("/api/ai/autonomous/log", headers=auth_headers)
        body = resp.json()
        assert "total" in body
        assert "runs" in body
        assert isinstance(body["runs"], list)

    async def test_log_contains_seeded_run(
        self, client: AsyncClient, auth_headers: dict
    ):
        await self._seed_run(client, auth_headers)
        resp = await client.get("/api/ai/autonomous/log", headers=auth_headers)
        body = resp.json()
        assert body["total"] >= 1
        assert len(body["runs"]) >= 1

    async def test_log_limit_param(self, client: AsyncClient, auth_headers: dict):
        # Seed a few runs
        for _ in range(3):
            await self._seed_run(client, auth_headers)
        resp = await client.get(
            "/api/ai/autonomous/log?limit=2", headers=auth_headers
        )
        body = resp.json()
        assert len(body["runs"]) <= 2

    async def test_log_run_has_actions(
        self, client: AsyncClient, auth_headers: dict
    ):
        await self._seed_run(client, auth_headers)
        resp = await client.get("/api/ai/autonomous/log", headers=auth_headers)
        body = resp.json()
        run = body["runs"][0]
        assert "actions" in run
        assert isinstance(run["actions"], list)


@pytest.mark.asyncio
class TestAutonomousOpsHealth:
    """Tests for GET /api/ai/autonomous/health."""

    async def test_health_returns_200(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/ai/autonomous/health", headers=auth_headers)
        assert resp.status_code == 200

    async def test_health_has_status_healthy(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.get("/api/ai/autonomous/health", headers=auth_headers)
        body = resp.json()
        assert body["status"] == "healthy"

    async def test_health_has_capabilities(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.get("/api/ai/autonomous/health", headers=auth_headers)
        body = resp.json()
        assert "capabilities" in body
        assert len(body["capabilities"]) > 0

    async def test_health_reports_demo_mode(
        self, client: AsyncClient, auth_headers: dict
    ):
        """In test env ANTHROPIC_API_KEY is not set → mode should be 'demo'."""
        resp = await client.get("/api/ai/autonomous/health", headers=auth_headers)
        body = resp.json()
        assert body["mode"] == "demo"
