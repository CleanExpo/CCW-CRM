"""Complete end-to-end test of Xero payment webhook flow.

This script:
1. Syncs an order to Xero (creates invoice with xero_invoice_id stored)
2. Simulates a payment webhook for that invoice
3. Verifies payment was recorded and order status updated to DELIVERED
"""

import asyncio
import base64
import hashlib
import hmac
import json
from datetime import datetime

import httpx


async def test_complete_payment_flow():
    """Test the complete payment flow end-to-end."""
    base_url = "http://localhost:8000"

    async with httpx.AsyncClient() as client:
        # Use the order we know has line items (ORD-2026-005)
        print("\n=== Step 1: Using order with line items ===")
        order_id = "4b0fd8ed-64e4-48a0-935d-062509f1829e"
        order_number = "ORD-2026-005"
        print(f"Selected order: {order_number} (ID: {order_id})")

        # Step 2: Sync order to Xero to create invoice
        print(f"\n=== Step 2: Syncing order to Xero ===")
        response = await client.post(f"{base_url}/api/integrations/xero/sync-order/{order_id}")

        if response.status_code != 200:
            print(f"[ERROR] Sync failed: {response.text}")
            return

        sync_result = response.json()
        print(f"[SUCCESS] Order synced to Xero!")
        print(f"  Invoice ID: {sync_result.get('xero_invoice_id')}")
        print(f"  Invoice Number: {sync_result.get('xero_invoice_number')}")
        print(f"  Total: ${sync_result.get('total')}")

        xero_invoice_id = sync_result.get("xero_invoice_id")

        # Step 3: Simulate payment webhook
        print(f"\n=== Step 3: Simulating payment webhook ===")

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
        webhook_key = "demo_webhook_key_abcdef"
        payload_json = json.dumps(webhook_payload)
        payload_bytes = payload_json.encode("utf-8")

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

        response = await client.post(
            f"{base_url}/api/integrations/xero/webhooks",
            content=payload_json,
            headers=webhook_headers,
        )

        if response.status_code != 200:
            print(f"[ERROR] Webhook failed: {response.text}")
            return

        webhook_result = response.json()
        print(f"[SUCCESS] Webhook processed!")
        print(f"Results: {json.dumps(webhook_result, indent=2)}")

        # Step 4: Verify order was updated
        print(f"\n=== Step 4: Verifying order status ===")
        response = await client.get(f"{base_url}/api/orders?page=1&page_size=100")

        if response.status_code != 200:
            print(f"[ERROR] Failed to get orders: {response.text}")
            return

        orders_data = response.json()
        orders = orders_data.get("items", [])

        # Find our order
        updated_order = next((o for o in orders if o["id"] == order_id), None)

        if not updated_order:
            print(f"[ERROR] Could not find order {order_id}")
            return

        print(f"Order status: {updated_order.get('status')}")

        if updated_order.get("status") == "delivered":
            print("\n" + "="*60)
            print("[SUCCESS] Payment webhook flow working correctly!")
            print("="*60)
            print("Results:")
            print(f"  1. Order {order_number} synced to Xero")
            print(f"  2. Invoice created with ID: {xero_invoice_id}")
            print(f"  3. Payment webhook processed successfully")
            print(f"  4. Order status updated to: {updated_order.get('status')}")
            print("="*60)
        else:
            print(f"\n[WARNING] Order status is '{updated_order.get('status')}', expected 'delivered'")
            print(f"Webhook results show: {webhook_result.get('results', [])}")


if __name__ == "__main__":
    print("=" * 60)
    print("Complete Xero Payment Webhook Flow Test")
    print("=" * 60)
    asyncio.run(test_complete_payment_flow())
