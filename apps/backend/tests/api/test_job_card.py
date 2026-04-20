"""Workshop job card API tests — UNI-1825 Phase 1.

Covers:
  GET   /api/workshop/jobs
  POST  /api/workshop/jobs
  GET   /api/workshop/jobs/{id}
  PATCH /api/workshop/jobs/{id}
  GET   /api/workshop/jobs/{id}/time-logs
  POST  /api/workshop/jobs/{id}/time-logs
  PATCH /api/workshop/jobs/{id}/time-logs/{log_id}

Uses the project's standard AsyncClient + auth_headers fixture pattern.
All tests are safe on a clean DB — they never assume pre-existing data.
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _create_card(client: AsyncClient, auth_headers: dict, title: str = "Test card") -> dict:
    resp = await client.post("/api/workshop/jobs", json={"title": title}, headers=auth_headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


# ---------------------------------------------------------------------------
# Job card CRUD
# ---------------------------------------------------------------------------


class TestJobCardList:
    @pytest.mark.asyncio
    async def test_list_returns_200(self, client: AsyncClient, auth_headers: dict) -> None:
        resp = await client.get("/api/workshop/jobs", headers=auth_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_list_is_paginated(self, client: AsyncClient, auth_headers: dict) -> None:
        resp = await client.get("/api/workshop/jobs", headers=auth_headers)
        data = resp.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "total_pages" in data

    @pytest.mark.asyncio
    async def test_list_status_filter_accepted(self, client: AsyncClient, auth_headers: dict) -> None:
        resp = await client.get("/api/workshop/jobs?status=open", headers=auth_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_list_equipment_filter_accepted(self, client: AsyncClient, auth_headers: dict) -> None:
        resp = await client.get(f"/api/workshop/jobs?equipment_id={uuid.uuid4()}", headers=auth_headers)
        assert resp.status_code == 200


class TestJobCardCreate:
    @pytest.mark.asyncio
    async def test_create_returns_201(self, client: AsyncClient, auth_headers: dict) -> None:
        resp = await client.post("/api/workshop/jobs", json={"title": "Oil change"}, headers=auth_headers)
        assert resp.status_code == 201

    @pytest.mark.asyncio
    async def test_create_shape(self, client: AsyncClient, auth_headers: dict) -> None:
        resp = await client.post("/api/workshop/jobs", json={"title": "Brake service"}, headers=auth_headers)
        data = resp.json()
        assert data["title"] == "Brake service"
        assert data["status"] == "open"
        assert data["job_number"].startswith("JC-")
        assert "id" in data
        assert "created_at" in data

    @pytest.mark.asyncio
    async def test_create_with_optional_fields(self, client: AsyncClient, auth_headers: dict) -> None:
        payload = {
            "title": "Full service",
            "description": "100-hour full service",
            "assigned_technician": "Alice Smith",
        }
        resp = await client.post("/api/workshop/jobs", json=payload, headers=auth_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["assigned_technician"] == "Alice Smith"
        assert data["description"] == "100-hour full service"

    @pytest.mark.asyncio
    async def test_create_missing_title_returns_422(self, client: AsyncClient, auth_headers: dict) -> None:
        resp = await client.post("/api/workshop/jobs", json={}, headers=auth_headers)
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_job_numbers_are_unique(self, client: AsyncClient, auth_headers: dict) -> None:
        r1 = await client.post("/api/workshop/jobs", json={"title": "Card A"}, headers=auth_headers)
        r2 = await client.post("/api/workshop/jobs", json={"title": "Card B"}, headers=auth_headers)
        assert r1.json()["job_number"] != r2.json()["job_number"]


class TestJobCardDetail:
    @pytest.mark.asyncio
    async def test_get_returns_200(self, client: AsyncClient, auth_headers: dict) -> None:
        card = await _create_card(client, auth_headers)
        resp = await client.get(f"/api/workshop/jobs/{card['id']}", headers=auth_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_get_shape(self, client: AsyncClient, auth_headers: dict) -> None:
        card = await _create_card(client, auth_headers, "Detail test")
        resp = await client.get(f"/api/workshop/jobs/{card['id']}", headers=auth_headers)
        data = resp.json()
        assert "job_card" in data
        assert "time_logs" in data
        assert isinstance(data["time_logs"], list)

    @pytest.mark.asyncio
    async def test_get_nonexistent_returns_404(self, client: AsyncClient, auth_headers: dict) -> None:
        resp = await client.get(f"/api/workshop/jobs/{uuid.uuid4()}", headers=auth_headers)
        assert resp.status_code == 404


class TestJobCardUpdate:
    @pytest.mark.asyncio
    async def test_update_status(self, client: AsyncClient, auth_headers: dict) -> None:
        card = await _create_card(client, auth_headers, "Status update test")
        resp = await client.patch(
            f"/api/workshop/jobs/{card['id']}",
            json={"status": "completed"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "completed"

    @pytest.mark.asyncio
    async def test_update_title(self, client: AsyncClient, auth_headers: dict) -> None:
        card = await _create_card(client, auth_headers, "Old title")
        resp = await client.patch(
            f"/api/workshop/jobs/{card['id']}",
            json={"title": "New title"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["title"] == "New title"

    @pytest.mark.asyncio
    async def test_update_nonexistent_returns_404(self, client: AsyncClient, auth_headers: dict) -> None:
        resp = await client.patch(
            f"/api/workshop/jobs/{uuid.uuid4()}",
            json={"status": "completed"},
            headers=auth_headers,
        )
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Time log endpoints
# ---------------------------------------------------------------------------


class TestTimeLogCreate:
    @pytest.mark.asyncio
    async def test_start_timer_returns_201(self, client: AsyncClient, auth_headers: dict) -> None:
        card = await _create_card(client, auth_headers, "Timer start test")
        now = datetime.now(UTC)
        resp = await client.post(
            f"/api/workshop/jobs/{card['id']}/time-logs",
            json={"technician_name": "Bob Jones", "started_at": now.isoformat()},
            headers=auth_headers,
        )
        assert resp.status_code == 201

    @pytest.mark.asyncio
    async def test_start_timer_shape(self, client: AsyncClient, auth_headers: dict) -> None:
        card = await _create_card(client, auth_headers, "Timer shape test")
        now = datetime.now(UTC)
        resp = await client.post(
            f"/api/workshop/jobs/{card['id']}/time-logs",
            json={"technician_name": "Carol White", "started_at": now.isoformat()},
            headers=auth_headers,
        )
        data = resp.json()
        assert data["technician_name"] == "Carol White"
        assert data["stopped_at"] is None
        assert data["duration_minutes"] is None
        assert "id" in data
        assert data["job_card_id"] == card["id"]

    @pytest.mark.asyncio
    async def test_complete_entry_computes_duration(self, client: AsyncClient, auth_headers: dict) -> None:
        card = await _create_card(client, auth_headers, "Duration test")
        start = datetime.now(UTC)
        stop = start + timedelta(hours=2)
        resp = await client.post(
            f"/api/workshop/jobs/{card['id']}/time-logs",
            json={
                "technician_name": "Dave Brown",
                "started_at": start.isoformat(),
                "stopped_at": stop.isoformat(),
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["duration_minutes"] == pytest.approx(120.0, abs=1.0)
        assert data["stopped_at"] is not None

    @pytest.mark.asyncio
    async def test_first_log_transitions_card_to_in_progress(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        card = await _create_card(client, auth_headers, "Status transition test")
        assert card["status"] == "open"

        now = datetime.now(UTC)
        await client.post(
            f"/api/workshop/jobs/{card['id']}/time-logs",
            json={"technician_name": "Eve Green", "started_at": now.isoformat()},
            headers=auth_headers,
        )

        detail = await client.get(f"/api/workshop/jobs/{card['id']}", headers=auth_headers)
        assert detail.json()["job_card"]["status"] == "in_progress"

    @pytest.mark.asyncio
    async def test_stop_before_start_returns_400(self, client: AsyncClient, auth_headers: dict) -> None:
        card = await _create_card(client, auth_headers, "Invalid entry test")
        start = datetime.now(UTC)
        stop = start - timedelta(hours=1)
        resp = await client.post(
            f"/api/workshop/jobs/{card['id']}/time-logs",
            json={
                "technician_name": "Frank Lee",
                "started_at": start.isoformat(),
                "stopped_at": stop.isoformat(),
            },
            headers=auth_headers,
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_nonexistent_job_returns_404(self, client: AsyncClient, auth_headers: dict) -> None:
        resp = await client.post(
            f"/api/workshop/jobs/{uuid.uuid4()}/time-logs",
            json={"technician_name": "Grace", "started_at": datetime.now(UTC).isoformat()},
            headers=auth_headers,
        )
        assert resp.status_code == 404


class TestTimeLogList:
    @pytest.mark.asyncio
    async def test_list_returns_200(self, client: AsyncClient, auth_headers: dict) -> None:
        card = await _create_card(client, auth_headers, "List logs test")
        resp = await client.get(f"/api/workshop/jobs/{card['id']}/time-logs", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    @pytest.mark.asyncio
    async def test_list_shows_created_logs(self, client: AsyncClient, auth_headers: dict) -> None:
        card = await _create_card(client, auth_headers, "Count test")
        start = datetime.now(UTC)
        for _ in range(3):
            await client.post(
                f"/api/workshop/jobs/{card['id']}/time-logs",
                json={"technician_name": "Henry", "started_at": start.isoformat()},
                headers=auth_headers,
            )

        resp = await client.get(f"/api/workshop/jobs/{card['id']}/time-logs", headers=auth_headers)
        assert len(resp.json()) == 3

    @pytest.mark.asyncio
    async def test_list_nonexistent_job_returns_404(self, client: AsyncClient, auth_headers: dict) -> None:
        resp = await client.get(f"/api/workshop/jobs/{uuid.uuid4()}/time-logs", headers=auth_headers)
        assert resp.status_code == 404


class TestTimeLogStop:
    @pytest.mark.asyncio
    async def test_stop_timer_records_duration(self, client: AsyncClient, auth_headers: dict) -> None:
        card = await _create_card(client, auth_headers, "Stop timer test")
        start = datetime.now(UTC)
        log_resp = await client.post(
            f"/api/workshop/jobs/{card['id']}/time-logs",
            json={"technician_name": "Ivy Chen", "started_at": start.isoformat()},
            headers=auth_headers,
        )
        log_id = log_resp.json()["id"]

        stop = start + timedelta(minutes=90)
        resp = await client.patch(
            f"/api/workshop/jobs/{card['id']}/time-logs/{log_id}",
            json={"stopped_at": stop.isoformat()},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["duration_minutes"] == pytest.approx(90.0, abs=1.0)
        assert data["stopped_at"] is not None

    @pytest.mark.asyncio
    async def test_stop_already_stopped_returns_400(self, client: AsyncClient, auth_headers: dict) -> None:
        card = await _create_card(client, auth_headers, "Double stop test")
        start = datetime.now(UTC)
        stop = start + timedelta(hours=1)
        log_resp = await client.post(
            f"/api/workshop/jobs/{card['id']}/time-logs",
            json={
                "technician_name": "Jack Wu",
                "started_at": start.isoformat(),
                "stopped_at": stop.isoformat(),
            },
            headers=auth_headers,
        )
        log_id = log_resp.json()["id"]

        resp = await client.patch(
            f"/api/workshop/jobs/{card['id']}/time-logs/{log_id}",
            json={"stopped_at": (stop + timedelta(minutes=30)).isoformat()},
            headers=auth_headers,
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_stop_nonexistent_log_returns_404(self, client: AsyncClient, auth_headers: dict) -> None:
        card = await _create_card(client, auth_headers, "Ghost log test")
        resp = await client.patch(
            f"/api/workshop/jobs/{card['id']}/time-logs/{uuid.uuid4()}",
            json={"stopped_at": datetime.now(UTC).isoformat()},
            headers=auth_headers,
        )
        assert resp.status_code == 404
