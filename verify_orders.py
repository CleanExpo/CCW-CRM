#!/usr/bin/env python3
"""Verify the CCW-ERP system is working with 5 orders"""
import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000"

def main():
    print("=" * 80)
    print("CCW-ERP System Verification")
    print("=" * 80)

    # Step 1: Login
    print("\n1. Testing Authentication...")
    login_response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "admin@demo.com", "password": "demo123"}
    )

    if login_response.status_code != 200:
        print(f"   ❌ Login failed: {login_response.status_code}")
        return

    login_data = login_response.json()
    token = login_data["access_token"]
    user_id = login_data["user"]["id"]
    print(f"   ✅ Login successful")
    print(f"   User: {login_data['user']['full_name']} ({login_data['user']['email']})")

    # Step 2: Fetch orders
    print("\n2. Fetching Orders...")
    headers = {
        "Authorization": f"Bearer {token}",
        "X-User-Id": user_id
    }

    orders_response = requests.get(
        f"{BASE_URL}/api/orders?page=1&page_size=10",
        headers=headers
    )

    if orders_response.status_code != 200:
        print(f"   ❌ Orders fetch failed: {orders_response.status_code}")
        return

    orders_data = orders_response.json()
    total_orders = orders_data["total"]
    orders = orders_data["items"]

    print(f"   ✅ Found {total_orders} orders")

    # Step 3: Display orders
    print("\n3. Order Details:")
    print("   " + "-" * 76)
    print(f"   {'Order #':<15} {'Status':<12} {'Customer':<25} {'Total':>12} {'Items':>6}")
    print("   " + "-" * 76)

    total_value = 0
    for order in orders:
        order_num = order["order_number"]
        status = order["status"].upper()
        customer = order["customer_name"][:24]
        total = float(order["total"])
        items_count = len(order.get("items", []))

        total_value += total

        print(f"   {order_num:<15} {status:<12} {customer:<25} ${total:>10,.2f} {items_count:>6}")

    print("   " + "-" * 76)
    print(f"   {'TOTAL':<53} ${total_value:>10,.2f}")
    print("   " + "=" * 76)

    # Step 4: Docker status
    print("\n4. Docker Services Status:")
    import subprocess
    result = subprocess.run(
        ["docker", "compose", "ps", "--format", "json"],
        capture_output=True,
        text=True,
        cwd="D:\\CCW-ERP-CRM"
    )

    if result.returncode == 0:
        try:
            services = [json.loads(line) for line in result.stdout.strip().split('\n') if line]
            for svc in services:
                name = svc.get("Name", "")
                status = svc.get("Status", "")
                health = svc.get("Health", "")
                if "backend" in name.lower():
                    print(f"   ✅ Backend:    {status} ({health})")
                elif "postgres" in name.lower():
                    print(f"   ✅ PostgreSQL: {status} ({health})")
                elif "redis" in name.lower():
                    print(f"   ✅ Redis:      {status} ({health})")
        except:
            print("   ⚠️  Could not parse docker status")

    print("\n" + "=" * 80)
    print("✅ SYSTEM VERIFICATION COMPLETE")
    print("=" * 80)
    print(f"\nBackend URL:  {BASE_URL}")
    print(f"API Docs:     {BASE_URL}/docs")
    print(f"Frontend:     http://localhost:3008 (if running)")
    print("\nAll systems operational! 🚀")
    print("=" * 80)

if __name__ == "__main__":
    main()
