#!/usr/bin/env python3
"""Quick check of CCW-ERP orders"""
import requests
import json

BASE_URL = "http://localhost:8000"

print("="*80)
print("CCW-ERP Order Verification")
print("="*80)

# Login
print("\n[1/3] Authenticating...")
login = requests.post(
    f"{BASE_URL}/api/auth/login",
    json={"email": "admin@demo.com", "password": "demo123"},
    timeout=5
)

if login.status_code != 200:
    print(f"ERROR: Login failed ({login.status_code})")
    exit(1)

data = login.json()
token = data["access_token"]
user_id = data["user"]["id"]
print(f"SUCCESS: Logged in as {data['user']['full_name']}")

# Fetch orders
print("\n[2/3] Fetching orders...")
orders = requests.get(
    f"{BASE_URL}/api/orders?page=1&page_size=10",
    headers={"Authorization": f"Bearer {token}", "X-User-Id": user_id},
    timeout=5
)

if orders.status_code != 200:
    print(f"ERROR: Orders fetch failed ({orders.status_code})")
    exit(1)

orders_data = orders.json()
total = orders_data["total"]
items = orders_data["items"]
print(f"SUCCESS: Found {total} orders in database")

# Display orders
print("\n[3/3] Order Summary:")
print("-"*80)
print(f"{'Order #':<15} {'Status':<12} {'Customer':<28} {'Total':>12} Items")
print("-"*80)

grand_total = 0
for order in items:
    num = order["order_number"]
    status = order["status"].title()
    customer = order["customer_name"][:27]
    amt = float(order["total"])
    item_count = len(order.get("items", []))

    grand_total += amt
    print(f"{num:<15} {status:<12} {customer:<28} ${amt:>10,.2f} {item_count:>5}")

print("-"*80)
print(f"{'TOTAL':<56} ${grand_total:>10,.2f}")
print("="*80)

print("\nSYSTEM STATUS:")
print(f"  Backend:    {BASE_URL}")
print(f"  Orders:     {total} in database")
print(f"  Total Value: ${grand_total:,.2f}")
print("\nAll systems operational!")
print("="*80)
