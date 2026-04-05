"""
Workshop API route tests (P1-11).

Uses TestClient — no real DB required. Tests route registration,
request validation, and 404/422 behaviour.
"""

import pytest
from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)
# Client that returns 500 rather than re-raising server exceptions (for DB-touching tests)
client_quiet = TestClient(app, raise_server_exceptions=False)


class TestWorkshopEquipmentRoutes:
    """GET/POST /api/workshop/equipment"""

    def test_list_equipment_registered(self):
        """Route must be registered — 200/500 acceptable (500 = no DB in test env), not 404."""
        response = client_quiet.get("/api/workshop/equipment")
        assert response.status_code not in (404, 422), "Workshop equipment list route not registered"

    def test_list_equipment_invalid_page_rejected(self):
        """page=0 violates ge=1 constraint — must return 422."""
        response = client.get("/api/workshop/equipment?page=0")
        assert response.status_code == 422

    def test_get_equipment_invalid_uuid(self):
        """Non-UUID equipment ID must return 422 (path param validation)."""
        response = client.get("/api/workshop/equipment/not-a-uuid")
        assert response.status_code == 422

    def test_create_equipment_missing_required_fields(self):
        """POST with empty body must return 422 (Pydantic validation)."""
        response = client.post("/api/workshop/equipment", json={})
        assert response.status_code == 422

    def test_create_equipment_invalid_customer_id(self):
        """customer_id must be a valid UUID."""
        response = client.post(
            "/api/workshop/equipment",
            json={
                "customer_id": "not-a-uuid",
                "serial_number": "SN-001",
                "make": "Karcher",
                "model": "HD 5/15",
                "location": "warehouse",
            },
        )
        assert response.status_code == 422

    def test_update_equipment_invalid_uuid(self):
        """Non-UUID ID on PUT must return 422 (path param validation)."""
        response = client.put(
            "/api/workshop/equipment/bad-id",
            json={"notes": "updated"},
        )
        assert response.status_code == 422

    def test_delete_equipment_invalid_uuid(self):
        """Non-UUID ID on DELETE must return 422."""
        response = client.delete("/api/workshop/equipment/bad-id")
        assert response.status_code == 422


class TestWorkshopBookingRoutes:
    """GET/POST /api/workshop/bookings"""

    def test_list_bookings_registered(self):
        """Route must be registered — 500 acceptable when DB unavailable."""
        response = client_quiet.get("/api/workshop/bookings")
        assert response.status_code not in (404, 422), "Workshop bookings list route not registered"

    def test_list_bookings_invalid_page(self):
        """page=0 must return 422."""
        response = client.get("/api/workshop/bookings?page=0")
        assert response.status_code == 422

    def test_create_booking_missing_fields(self):
        """POST with empty body must return 422."""
        response = client.post("/api/workshop/bookings", json={})
        assert response.status_code == 422

    def test_get_booking_invalid_uuid(self):
        """Non-UUID booking ID must return 422."""
        response = client.get("/api/workshop/bookings/not-a-uuid")
        assert response.status_code == 422


class TestWorkshopDashboardRoute:
    """GET /api/workshop/dashboard"""

    def test_dashboard_registered(self):
        """Route must be registered — 500 acceptable when DB unavailable."""
        response = client_quiet.get("/api/workshop/dashboard")
        assert response.status_code not in (404, 422), "Workshop dashboard route not registered"


class TestWorkshopTemplateRoutes:
    """GET /api/workshop/templates"""

    def test_list_templates_registered(self):
        """Route must be registered — 500 acceptable when DB unavailable."""
        response = client_quiet.get("/api/workshop/templates")
        assert response.status_code not in (404, 422), "Workshop templates route not registered"

    def test_create_template_missing_fields(self):
        """POST with empty body must return 422."""
        response = client.post("/api/workshop/templates", json={})
        assert response.status_code == 422


class TestWorkshopReminderRoutes:
    """GET /api/workshop/reminders"""

    def test_list_reminders_registered(self):
        """Route must be registered — 500 acceptable when DB unavailable."""
        response = client_quiet.get("/api/workshop/reminders")
        assert response.status_code not in (404, 422), "Workshop reminders route not registered"
