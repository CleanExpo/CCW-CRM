"""
Integration tests for ERP API bug fixes.

These tests run against the actual development database and API.
Prerequisites:
1. PostgreSQL database must be running (docker compose up)
2. Backend API must be running (npm run dev or uvicorn)
3. Database must have test data (run seed_demo.py)

These are integration tests, not unit tests. They verify the bug fixes work
in the real environment.
"""

import requests
import pytest
from typing import Dict, Any

# API base URL - adjust if running on different port
API_BASE_URL = "http://localhost:8000"


class TestOrderStatusUpdateBugFix:
    """
    Test Fix #1: Order status updates persisting correctly.

    Bug: Frontend sending subtotal/tax fields caused status updates to fail.
    Fix: Filter invalid fields before updating (orders.py:177-180).
    """

    def test_order_status_update_persists(self):
        """Test that order status updates actually persist to database."""
        # Get an existing order
        response = requests.get(f"{API_BASE_URL}/api/orders", params={"page": 1, "page_size": 1})
        assert response.status_code == 200

        data = response.json()
        if not data["items"]:
            pytest.skip("No orders in database to test")

        order = data["items"][0]
        order_id = order["id"]
        original_status = order["status"]

        # Try to update status (simulating frontend sending invalid fields)
        new_status = "processing" if original_status != "processing" else "confirmed"
        update_data = {
            "status": new_status,
            "subtotal": 100.00,  # Invalid field - should be ignored
            "tax": 10.00,  # Invalid field - should be ignored
        }

        response = requests.put(f"{API_BASE_URL}/api/orders/{order_id}", json=update_data)
        assert response.status_code == 200

        updated_order = response.json()
        assert updated_order["status"] == new_status, f"Status should be {new_status}, got {updated_order['status']}"

        # Verify by fetching again
        response = requests.get(f"{API_BASE_URL}/api/orders/{order_id}")
        assert response.status_code == 200

        fetched_order = response.json()
        assert fetched_order["status"] == new_status, "Status update did not persist"

        # Restore original status
        requests.put(f"{API_BASE_URL}/api/orders/{order_id}", json={"status": original_status})


class TestQuoteDeleteBugFix:
    """
    Test Fix #2: Quote DELETE endpoint now exists.

    Bug: DELETE /api/quotes/{id} returned 405 Method Not Allowed.
    Fix: Added DELETE endpoint (quotes.py:210-228).
    """

    def test_quote_delete_endpoint_exists(self):
        """Test that DELETE endpoint is available and returns correct status code."""
        # Try to delete a non-existent quote (should return 404, not 405)
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = requests.delete(f"{API_BASE_URL}/api/quotes/{fake_id}")

        # Should be 404 (not found), NOT 405 (method not allowed)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}. If 405, DELETE endpoint is missing!"

    def test_quote_delete_with_real_quote(self):
        """Test deleting a real quote (requires creating one first)."""
        # Get customers and products for creating a quote
        customers_response = requests.get(f"{API_BASE_URL}/api/customers", params={"page": 1, "page_size": 1})
        products_response = requests.get(f"{API_BASE_URL}/api/products", params={"page": 1, "page_size": 1})

        if customers_response.status_code != 200 or products_response.status_code != 200:
            pytest.skip("Cannot access customers or products")

        customers = customers_response.json()["items"]
        products = products_response.json()["items"]

        if not customers or not products:
            pytest.skip("No customers or products to test with")

        # Create a test quote
        quote_data = {
            "customer_id": customers[0]["id"],
            "status": "draft",
            "quote_date": "2026-01-07",
            "valid_until": "2026-02-07",
            "notes": "Test quote for deletion",
            "items": [
                {
                    "product_id": products[0]["id"],
                    "quantity": 1,
                }
            ]
        }

        create_response = requests.post(f"{API_BASE_URL}/api/quotes", json=quote_data)
        if create_response.status_code != 201:
            pytest.skip(f"Cannot create test quote: {create_response.text}")

        quote_id = create_response.json()["id"]

        # Now delete it
        delete_response = requests.delete(f"{API_BASE_URL}/api/quotes/{quote_id}")
        assert delete_response.status_code == 204, f"Expected 204, got {delete_response.status_code}"

        # Verify it's gone
        get_response = requests.get(f"{API_BASE_URL}/api/quotes/{quote_id}")
        assert get_response.status_code == 404, "Quote should be deleted"


class TestQuoteLineItemsDisplayBugFix:
    """
    Test Fix #3: Quote line items display correctly.

    Bug: Frontend expected quote_items field, backend returns items.
    Fix: Updated frontend interface (QuoteForm.tsx:71,123-130).
    """

    def test_quote_api_returns_items_field(self):
        """Test that API returns 'items' field (not 'quote_items')."""
        response = requests.get(f"{API_BASE_URL}/api/quotes", params={"page": 1, "page_size": 1})
        assert response.status_code == 200

        data = response.json()
        if not data["items"]:
            pytest.skip("No quotes in database")

        quote = data["items"][0]
        quote_id = quote["id"]

        # Get full quote details
        detail_response = requests.get(f"{API_BASE_URL}/api/quotes/{quote_id}")
        assert detail_response.status_code == 200

        quote_detail = detail_response.json()

        # Check that API returns 'items' field
        assert "items" in quote_detail, "API should return 'items' field"
        assert "quote_items" not in quote_detail, "API should NOT return 'quote_items' field"

    def test_quote_numeric_values_are_serializable(self):
        """Test that numeric values in quote items are properly serialized."""
        response = requests.get(f"{API_BASE_URL}/api/quotes", params={"page": 1, "page_size": 1})
        assert response.status_code == 200

        data = response.json()
        if not data["items"]:
            pytest.skip("No quotes in database")

        quote = data["items"][0]
        quote_id = quote["id"]

        # Get full quote with items
        detail_response = requests.get(f"{API_BASE_URL}/api/quotes/{quote_id}")
        assert detail_response.status_code == 200

        quote_detail = detail_response.json()

        if not quote_detail.get("items"):
            pytest.skip("Quote has no items")

        # Check that numeric fields exist and are valid
        first_item = quote_detail["items"][0]

        assert "quantity" in first_item
        assert "unit_price" in first_item
        assert "line_total" in first_item

        # Verify they can be converted to numbers (important for frontend)
        assert isinstance(first_item["quantity"], int) or float(first_item["quantity"])
        assert float(first_item["unit_price"]) >= 0
        assert float(first_item["line_total"]) >= 0


class TestBugFixesIntegration:
    """Integration tests verifying all bug fixes work together."""

    def test_complete_workflow_order_status_updates(self):
        """Test complete workflow: create order, update status multiple times."""
        # Get required data
        customers_response = requests.get(f"{API_BASE_URL}/api/customers", params={"page": 1, "page_size": 1})
        products_response = requests.get(f"{API_BASE_URL}/api/products", params={"page": 1, "page_size": 1})

        if customers_response.status_code != 200 or products_response.status_code != 200:
            pytest.skip("Cannot access customers or products")

        customers = customers_response.json()["items"]
        products = products_response.json()["items"]

        if not customers or not products:
            pytest.skip("No customers or products to test with")

        # Create order
        order_data = {
            "customer_id": customers[0]["id"],
            "status": "draft",
            "notes": "Integration test order",
            "items": [{"product_id": products[0]["id"], "quantity": 1}]
        }

        create_response = requests.post(f"{API_BASE_URL}/api/orders", json=order_data)
        if create_response.status_code != 201:
            pytest.skip(f"Cannot create order: {create_response.text}")

        order_id = create_response.json()["id"]

        try:
            # Update 1: draft -> confirmed
            response = requests.put(
                f"{API_BASE_URL}/api/orders/{order_id}",
                json={"status": "confirmed"}
            )
            assert response.status_code == 200
            assert response.json()["status"] == "confirmed"

            # Update 2: confirmed -> processing (with invalid fields to test Fix #1)
            response = requests.put(
                f"{API_BASE_URL}/api/orders/{order_id}",
                json={
                    "status": "processing",
                    "subtotal": 100,  # Invalid field
                    "tax": 10,  # Invalid field
                }
            )
            assert response.status_code == 200
            assert response.json()["status"] == "processing"

            # Verify status persisted
            response = requests.get(f"{API_BASE_URL}/api/orders/{order_id}")
            assert response.status_code == 200
            assert response.json()["status"] == "processing"

        finally:
            # Cleanup: delete the test order (if delete endpoint exists)
            requests.delete(f"{API_BASE_URL}/api/orders/{order_id}")


def test_api_is_running():
    """Prerequisite test: Verify API is running and accessible."""
    try:
        response = requests.get(f"{API_BASE_URL}/api/products", params={"page": 1, "page_size": 1}, timeout=5)
        assert response.status_code == 200, f"API returned {response.status_code}"
    except requests.exceptions.ConnectionError:
        pytest.fail("API is not running. Start it with: cd apps/backend && uvicorn src.api.main:app --reload")
    except requests.exceptions.Timeout:
        pytest.fail("API request timed out. Check if API is running.")


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v", "--tb=short"])
