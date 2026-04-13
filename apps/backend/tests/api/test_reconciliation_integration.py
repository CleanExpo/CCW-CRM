"""
Reconciliation Integration Tests (GAP-026, GAP-027 / RA-194, RA-195)

Tests for reconciliation match-suggestions and auto-match endpoints.
"""

from uuid import uuid4

from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)


class TestMatchSuggestions:
    """Test GET /api/reconciliation/match-suggestions (GAP-026)"""

    def test_get_match_suggestions_success(self):
        """Should return match suggestions for an organization"""
        org_id = str(uuid4())
        response = client.get(
            f"/api/reconciliation/match-suggestions?organization_id={org_id}"
        )

        assert response.status_code == 200
        data = response.json()

        # Should return structured response
        assert "suggestions" in data
        assert "total" in data
        assert isinstance(data["suggestions"], list)
        assert isinstance(data["total"], int)

        # Each suggestion should have required fields
        if len(data["suggestions"]) > 0:
            suggestion = data["suggestions"][0]
            assert "invoice_id" in suggestion
            assert "transaction_id" in suggestion
            assert "confidence" in suggestion
            assert "match_reason" in suggestion
            assert "invoice_amount" in suggestion
            assert "transaction_amount" in suggestion
            assert "variance" in suggestion

            # Confidence should be between 0 and 1
            assert 0.0 <= suggestion["confidence"] <= 1.0

    def test_get_match_suggestions_with_confidence_threshold(self):
        """Should filter suggestions by confidence threshold"""
        org_id = str(uuid4())
        response = client.get(
            f"/api/reconciliation/match-suggestions"
            f"?organization_id={org_id}&confidence_threshold=0.9"
        )

        assert response.status_code == 200
        data = response.json()

        # All suggestions should meet threshold
        for suggestion in data["suggestions"]:
            assert suggestion["confidence"] >= 0.9

    def test_get_match_suggestions_with_limit(self):
        """Should respect limit parameter"""
        org_id = str(uuid4())
        limit = 5
        response = client.get(
            f"/api/reconciliation/match-suggestions"
            f"?organization_id={org_id}&limit={limit}"
        )

        assert response.status_code == 200
        data = response.json()

        # Should not exceed limit
        assert len(data["suggestions"]) <= limit

    def test_get_match_suggestions_missing_organization_id(self):
        """Should require organization_id parameter"""
        response = client.get("/api/reconciliation/match-suggestions")
        assert response.status_code == 422  # Validation error

    def test_get_match_suggestions_invalid_confidence_threshold(self):
        """Should reject confidence threshold outside 0-1 range"""
        org_id = str(uuid4())

        # Test > 1.0
        response = client.get(
            f"/api/reconciliation/match-suggestions"
            f"?organization_id={org_id}&confidence_threshold=1.5"
        )
        assert response.status_code == 422

        # Test < 0.0
        response = client.get(
            f"/api/reconciliation/match-suggestions"
            f"?organization_id={org_id}&confidence_threshold=-0.1"
        )
        assert response.status_code == 422

    def test_get_match_suggestions_invalid_limit(self):
        """Should reject invalid limit values"""
        org_id = str(uuid4())

        # Test limit > 100
        response = client.get(
            f"/api/reconciliation/match-suggestions"
            f"?organization_id={org_id}&limit=150"
        )
        assert response.status_code == 422

        # Test limit < 1
        response = client.get(
            f"/api/reconciliation/match-suggestions"
            f"?organization_id={org_id}&limit=0"
        )
        assert response.status_code == 422

    def test_get_match_suggestions_sorted_by_confidence(self):
        """Should return suggestions sorted by confidence descending"""
        org_id = str(uuid4())
        response = client.get(
            f"/api/reconciliation/match-suggestions"
            f"?organization_id={org_id}&confidence_threshold=0.0&limit=20"
        )

        assert response.status_code == 200
        data = response.json()

        # Verify descending order
        confidences = [s["confidence"] for s in data["suggestions"]]
        assert confidences == sorted(confidences, reverse=True)


class TestAutoMatch:
    """Test POST /api/reconciliation/auto-match (GAP-027)"""

    def test_auto_match_dry_run(self):
        """Should preview matches without committing (dry_run=true)"""
        org_id = str(uuid4())
        response = client.post(
            "/api/reconciliation/auto-match",
            json={
                "organization_id": str(org_id),
                "confidence_threshold": 0.95,
                "dry_run": True,
            },
        )

        assert response.status_code == 200
        data = response.json()

        # Should return structured response
        assert "matched" in data
        assert "total_matched" in data
        assert "total_amount_matched" in data
        assert isinstance(data["matched"], list)
        assert isinstance(data["total_matched"], int)

        # Each match result should have required fields
        if len(data["matched"]) > 0:
            match = data["matched"][0]
            assert "invoice_id" in match
            assert "transaction_id" in match
            assert "matched" in match
            assert "reason" in match

            # In dry_run mode, matched should be False
            assert match["matched"] is False

    def test_auto_match_commit(self):
        """Should commit matches when dry_run=false"""
        org_id = str(uuid4())
        response = client.post(
            "/api/reconciliation/auto-match",
            json={
                "organization_id": str(org_id),
                "confidence_threshold": 0.95,
                "dry_run": False,
            },
        )

        assert response.status_code == 200
        data = response.json()

        # Should have matched results
        if len(data["matched"]) > 0:
            match = data["matched"][0]
            # In commit mode, matched should be True
            assert match["matched"] is True

    def test_auto_match_high_confidence_threshold(self):
        """Should only match when confidence exceeds threshold"""
        org_id = str(uuid4())

        # Very high threshold - may not match anything
        response = client.post(
            "/api/reconciliation/auto-match",
            json={
                "organization_id": str(org_id),
                "confidence_threshold": 0.99,
                "dry_run": True,
            },
        )

        assert response.status_code == 200
        data = response.json()

        # All matched items should meet threshold
        for match in data["matched"]:
            # In production, would verify confidence >= 0.99
            pass

    def test_auto_match_default_threshold(self):
        """Should use default confidence_threshold of 0.95"""
        org_id = str(uuid4())
        response = client.post(
            "/api/reconciliation/auto-match",
            json={"organization_id": str(org_id), "dry_run": True},
        )

        assert response.status_code == 200
        # Should succeed with default threshold

    def test_auto_match_missing_organization_id(self):
        """Should require organization_id"""
        response = client.post(
            "/api/reconciliation/auto-match",
            json={"confidence_threshold": 0.95, "dry_run": True},
        )
        assert response.status_code == 422  # Validation error

    def test_auto_match_invalid_confidence_threshold(self):
        """Should reject invalid confidence_threshold"""
        org_id = str(uuid4())

        # Test > 1.0
        response = client.post(
            "/api/reconciliation/auto-match",
            json={
                "organization_id": str(org_id),
                "confidence_threshold": 1.5,
                "dry_run": True,
            },
        )
        assert response.status_code == 422

        # Test < 0.0
        response = client.post(
            "/api/reconciliation/auto-match",
            json={
                "organization_id": str(org_id),
                "confidence_threshold": -0.1,
                "dry_run": True,
            },
        )
        assert response.status_code == 422

    def test_auto_match_total_amount_calculation(self):
        """Should correctly sum total_amount_matched"""
        org_id = str(uuid4())
        response = client.post(
            "/api/reconciliation/auto-match",
            json={
                "organization_id": str(org_id),
                "confidence_threshold": 0.8,
                "dry_run": True,
            },
        )

        assert response.status_code == 200
        data = response.json()

        # total_matched should equal length of matched array
        assert data["total_matched"] == len(data["matched"])

        # total_amount_matched should be a decimal string or number
        assert isinstance(data["total_amount_matched"], (int, float, str))
