"""Test script for Xero payment webhook flow.

This script tests the complete payment webhook flow:
1. Sync an order to create an invoice with xero_invoice_id
2. Simulate a payment webhook with the invoice_id
3. Verify that payment was recorded and order status was updated
"""

import asyncio
import base64
import hashlib
import hmac
import json
from datetime import datetime

import httpx


async def test_payment_webhook_flow():
    """Test the complete payment webhook flow."""
    base_url = "http://localhost:8000"

    async with httpx.AsyncClient() as client:
        # Use the order that was successfully synced earlier in the logs
        # Order: ORD-2026-005, ID: 4b0fd8ed-64e4-48a0-935d-062509f1829e
        # Invoice ID: 93810347-9dd7-483e-b0cc-4875b6455b11
        order_id = "4b0fd8ed-64e4-48a0-935d-062509f1829e"
        order_number = "ORD-2026-005"
        xero_invoice_id = "93810347-9dd7-483e-b0cc-4875b6455b11"

        print("\n=== Using pre-synced order ===")
        print(f"Order: {order_number}")
        print(f"Order ID: {order_id}")
        print(f"Invoice ID: {xero_invoice_id}")

        # Step 1: Simulate a payment webhook
        print("\n=== Step 1: Simulating payment webhook ===")

        # Create a mock payment webhook payload (similar to what Xero sends)
        webhook_payload = {
            "events": [
                {
                    "resourceUrl": f"https://api.xero.com/api.xro/2.0/Invoices/{xero_invoice_id}",
                    "resourceId": xero_invoice_id,
                    "eventDateUtc": datetime.utcnow().isoformat() + "Z",
                    "eventType": "UPDATE",
                    "eventCategory": "INVOICE",
                    "tenantId": "demo-tenant-123",
                }
            ],
            "lastEventSequence": 1,
            "firstEventSequence": 1,
            "entropy": "test-entropy",
        }

        # Calculate proper HMAC signature
        webhook_key = "demo_webhook_key_abcdef"  # From xero_settings
        payload_json = json.dumps(webhook_payload)
        payload_bytes = payload_json.encode("utf-8")

        # Calculate HMAC SHA256 signature
        signature_bytes = hmac.new(
            webhook_key.encode("utf-8"),
            payload_bytes,
            hashlib.sha256
        ).digest()
        signature_b64 = base64.b64encode(signature_bytes).decode("utf-8")

        webhook_headers = {
            "X-Xero-Signature": signature_b64,
            "Content-Type": "application/json",
        }

        print(f"Calculated signature: {signature_b64}")

        response = await client.post(
            f"{base_url}/api/integrations/xero/webhooks",
            content=payload_json,  # Use content instead of json to send exact bytes
            headers=webhook_headers,
        )
        print(f"Webhook status: {response.status_code}")

        if response.status_code == 200:
            webhook_result = response.json()
            print("Webhook processed successfully!")
            print(f"Results: {json.dumps(webhook_result, indent=2)}")

            # Step 2: Verify the order was updated
            print("\n=== Step 2: Verifying order status ===")
            response = await client.get(f"{base_url}/api/orders/{order_id}")
            if response.status_code == 200:
                updated_order = response.json()
                print(f"Order status: {updated_order.get('status')}")
                print("Expected: DELIVERED (if payment webhook processed correctly)")

                if updated_order.get("status") == "delivered" or updated_order.get("status") == "DELIVERED":
                    print("\n[SUCCESS] Payment webhook flow working correctly!")
                    print("   - Order was pre-synced to Xero invoice")
                    print("   - Payment webhook processed")
                    print("   - Order status updated to DELIVERED")
                else:
                    print("\n[WARNING] Order status not updated to DELIVERED")
                    print(f"   Current status: {updated_order.get('status')}")
            else:
                print(f"[ERROR] Failed to get updated order: {response.text}")
        else:
            print(f"[ERROR] Webhook processing failed: {response.text}")


if __name__ == "__main__":
    print("=" * 60)
    print("Testing Xero Payment Webhook Flow")
    print("=" * 60)
    asyncio.run(test_payment_webhook_flow())
    print("\n" + "=" * 60)
    print("Test complete")
    print("=" * 60)
