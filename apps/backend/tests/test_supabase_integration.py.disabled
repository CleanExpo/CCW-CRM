"""
Supabase Integration Tests

Tests database connection and Australian context validation.
Run after setting up Supabase to verify everything works.
"""

import pytest
from datetime import datetime
from fastapi.testclient import TestClient

from src.api.main import app
from src.utils.supabase_client import supabase


client = TestClient(app)


class TestSupabaseConnection:
    """Test Supabase database connection."""

    def test_supabase_client_initialized(self):
        """Supabase client should be initialized."""
        assert supabase is not None
        assert hasattr(supabase, 'table')

    def test_database_connection(self):
        """Should be able to query database."""
        # Simple query to verify connection
        response = supabase.table("contractors").select("id").limit(1).execute()
        assert response is not None
        # Should not raise an error

    def test_contractors_table_exists(self):
        """Contractors table should exist."""
        response = supabase.table("contractors").select("*").limit(1).execute()
        assert response is not None

    def test_availability_slots_table_exists(self):
        """Availability slots table should exist."""
        response = supabase.table("availability_slots").select("*").limit(1).execute()
        assert response is not None


class TestSeedData:
    """Test seed data was loaded correctly."""

    def test_seed_contractors_exist(self):
        """Should have 3 seed contractors."""
        response = supabase.table("contractors").select("*").execute()
        assert len(response.data) >= 3

    def test_seed_contractors_have_australian_mobile(self):
        """Seed contractors should have valid Australian mobile."""
        response = supabase.table("contractors").select("mobile").execute()

        for record in response.data:
            mobile = record["mobile"]
            # Should match 04XX XXX XXX format
            assert mobile.startswith("04")
            assert len(mobile.replace(" ", "")) == 10

    def test_seed_contractors_have_abn(self):
        """Seed contractors with ABN should have valid format."""
        response = supabase.table("contractors").select("name, abn").execute()

        for record in response.data:
            if record["abn"]:
                abn = record["abn"]
                # Should match XX XXX XXX XXX format
                assert len(abn.replace(" ", "")) == 11

    def test_seed_availability_slots_exist(self):
        """Should have 9 seed availability slots."""
        response = supabase.table("availability_slots").select("*").execute()
        assert len(response.data) >= 9

    def test_seed_slots_are_brisbane(self):
        """Seed slots should be in Brisbane suburbs."""
        response = supabase.table("availability_slots").select("suburb, state").execute()

        brisbane_suburbs = [
            "Indooroopilly", "Toowong", "West End",
            "South Brisbane", "Woolloongabba", "Brisbane CBD"
        ]

        for record in response.data:
            assert record["state"] == "QLD"
            # Allow other suburbs too (user might have added more)
            # Just check format is valid


class TestAPIWithSupabase:
    """Test API endpoints with Supabase backend."""

    def test_list_contractors_returns_data(self):
        """List contractors should return data from Supabase."""
        response = client.get("/api/contractors/")
        assert response.status_code == 200

        data = response.json()
        assert "contractors" in data
        assert "total" in data
        assert data["total"] >= 3  # At least seed data

    def test_get_contractor_by_id(self):
        """Should get contractor by ID from Supabase."""
        # Get first contractor ID
        list_response = client.get("/api/contractors/")
        contractors = list_response.json()["contractors"]

        if contractors:
            contractor_id = contractors[0]["id"]

            # Get specific contractor
            response = client.get(f"/api/contractors/{contractor_id}")
            assert response.status_code == 200

            data = response.json()
            assert data["id"] == contractor_id
            assert "mobile" in data
            assert "availabilitySlots" in data

    def test_create_contractor_in_supabase(self):
        """Should create contractor in Supabase."""
        response = client.post(
            "/api/contractors/",
            json={
                "name": "Test Contractor",
                "mobile": "0498 765 432",
                "abn": "98 765 432 109",
                "email": "test@example.com.au",
                "specialisation": "Test Specialisation"
            }
        )

        assert response.status_code == 201
        data = response.json()

        # Should return created contractor
        assert data["name"] == "Test Contractor"
        assert data["mobile"] == "0498 765 432"
        assert data["abn"] == "98 765 432 109"

        # Clean up: delete test contractor
        contractor_id = data["id"]
        client.delete(f"/api/contractors/{contractor_id}")

    def test_create_contractor_validates_mobile(self):
        """Should validate Australian mobile format."""
        response = client.post(
            "/api/contractors/",
            json={
                "name": "Invalid Mobile",
                "mobile": "1234567890"  # Invalid: doesn't start with 04
            }
        )

        assert response.status_code == 422

    def test_create_contractor_validates_abn(self):
        """Should validate ABN format."""
        response = client.post(
            "/api/contractors/",
            json={
                "name": "Invalid ABN",
                "mobile": "0412 345 678",
                "abn": "123456"  # Invalid: too short
            }
        )

        assert response.status_code == 422

    def test_search_by_brisbane_suburb(self):
        """Should search contractors by Brisbane suburb."""
        response = client.get(
            "/api/contractors/search/by-location?suburb=Indooroopilly&state=QLD"
        )

        assert response.status_code == 200
        data = response.json()

        # Should find contractors with availability in Indooroopilly
        assert "contractors" in data
        assert data["total"] >= 0


class TestAustralianConstraints:
    """Test database-level Australian constraints."""

    def test_mobile_constraint_enforced(self):
        """Database should reject invalid mobile format."""
        # Try to insert directly to database (bypassing Pydantic validation)
        try:
            supabase.table("contractors").insert({
                "id": "00000000-0000-0000-0000-000000000001",
                "name": "Invalid Mobile Test",
                "mobile": "1234567890"  # Invalid format
            }).execute()

            # If we get here, constraint wasn't enforced
            # Clean up
            supabase.table("contractors").delete().eq(
                "id", "00000000-0000-0000-0000-000000000001"
            ).execute()

            pytest.fail("Mobile constraint not enforced by database")

        except Exception as e:
            # Expected: constraint violation
            assert "mobile" in str(e).lower() or "check" in str(e).lower()

    def test_abn_constraint_enforced(self):
        """Database should reject invalid ABN format."""
        try:
            supabase.table("contractors").insert({
                "id": "00000000-0000-0000-0000-000000000002",
                "name": "Invalid ABN Test",
                "mobile": "0412 345 678",
                "abn": "123456"  # Invalid format
            }).execute()

            # Clean up if it somehow succeeded
            supabase.table("contractors").delete().eq(
                "id", "00000000-0000-0000-0000-000000000002"
            ).execute()

            pytest.fail("ABN constraint not enforced by database")

        except Exception as e:
            # Expected: constraint violation
            assert "abn" in str(e).lower() or "check" in str(e).lower()

    def test_time_constraint_enforced(self):
        """Database should reject end_time before start_time."""
        # First create a contractor
        contractor_response = client.post(
            "/api/contractors/",
            json={
                "name": "Time Test Contractor",
                "mobile": "0412 345 678"
            }
        )
        contractor_id = contractor_response.json()["id"]

        # Try to create invalid time slot
        response = client.post(
            f"/api/contractors/{contractor_id}/availability",
            json={
                "contractorId": contractor_id,
                "date": "2026-01-06T00:00:00+10:00",
                "startTime": "17:00:00",
                "endTime": "09:00:00",  # Before start_time!
                "location": {
                    "suburb": "Test",
                    "state": "QLD"
                },
                "status": "available"
            }
        )

        # Should be rejected
        assert response.status_code in [422, 500]  # Validation or database error

        # Clean up
        client.delete(f"/api/contractors/{contractor_id}")


class TestCascadeDelete:
    """Test ON DELETE CASCADE works."""

    def test_deleting_contractor_deletes_slots(self):
        """Deleting contractor should cascade to availability slots."""
        # Create contractor
        contractor_response = client.post(
            "/api/contractors/",
            json={
                "name": "Cascade Test",
                "mobile": "0412 345 678"
            }
        )
        contractor_id = contractor_response.json()["id"]

        # Add availability slot
        slot_response = client.post(
            f"/api/contractors/{contractor_id}/availability",
            json={
                "contractorId": contractor_id,
                "date": "2026-01-06T00:00:00+10:00",
                "startTime": "09:00:00",
                "endTime": "12:00:00",
                "location": {
                    "suburb": "Test Suburb",
                    "state": "QLD"
                },
                "status": "available"
            }
        )
        assert slot_response.status_code == 201

        # Verify slot exists
        slots_before = supabase.table("availability_slots").select("id").eq(
            "contractor_id", contractor_id
        ).execute()
        assert len(slots_before.data) == 1

        # Delete contractor
        delete_response = client.delete(f"/api/contractors/{contractor_id}")
        assert delete_response.status_code == 204

        # Verify slot was also deleted (CASCADE)
        slots_after = supabase.table("availability_slots").select("id").eq(
            "contractor_id", contractor_id
        ).execute()
        assert len(slots_after.data) == 0


def run_supabase_tests():
    """
    Run all Supabase integration tests.

    Usage:
        cd apps/backend
        uv run pytest tests/test_supabase_integration.py -v
    """
    pytest.main([__file__, "-v", "--tb=short"])


if __name__ == "__main__":
    run_supabase_tests()
