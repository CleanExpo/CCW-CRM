"""
Integration test for ISS-005 fixes (500 internal server errors).

Tests that previously-failing scenarios now return proper error codes instead of 500.
"""
import sys
from pathlib import Path
from uuid import uuid4

backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

print("=" * 80)
print("ISS-005 INTEGRATION TEST")
print("Testing actual HTTP requests for proper error handling")
print("=" * 80)

# Import FastAPI test client
try:
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from src.api.routes import orders, purchase_orders, quotes
    print("\n[PASS] Imports successful")
except Exception as e:
    print(f"\n[FAIL] Import error: {e}")
    sys.exit(1)

# Create minimal test app with only the routes we're testing
app = FastAPI()
app.include_router(orders.router)
app.include_router(quotes.router)
app.include_router(purchase_orders.router)
client = TestClient(app)

test_results = []

# TEST 1: Get non-existent order (should return 404, not 500)
print("\n[TEST 1] Testing GET non-existent order...")
try:
    fake_id = str(uuid4())
    response = client.get(f"/api/orders/{fake_id}")

    if response.status_code == 404:
        print("[PASS] Got 404 as expected")
        test_results.append(("GET non-existent order", "PASS", 404))
    elif response.status_code == 500:
        print("[FAIL] Got 500 error - fix didn't work!")
        print(f"       Response: {response.text[:200]}")
        test_results.append(("GET non-existent order", "FAIL", 500))
    else:
        print(f"[INFO] Got {response.status_code} (acceptable, not 500)")
        test_results.append(("GET non-existent order", "PASS", response.status_code))
except Exception as e:
    print(f"[FAIL] Request failed: {e}")
    test_results.append(("GET non-existent order", "FAIL", "exception"))

# TEST 2: Update non-existent order (should return 404, not 500)
print("\n[TEST 2] Testing PUT non-existent order...")
try:
    fake_id = str(uuid4())
    response = client.put(
        f"/api/orders/{fake_id}",
        json={"status": "confirmed"}
    )

    if response.status_code == 404:
        print("[PASS] Got 404 as expected")
        test_results.append(("PUT non-existent order", "PASS", 404))
    elif response.status_code == 500:
        print("[FAIL] Got 500 error")
        print(f"       Response: {response.text[:200]}")
        test_results.append(("PUT non-existent order", "FAIL", 500))
    else:
        print(f"[INFO] Got {response.status_code} (acceptable, not 500)")
        test_results.append(("PUT non-existent order", "PASS", response.status_code))
except Exception as e:
    print(f"[FAIL] Request failed: {e}")
    test_results.append(("PUT non-existent order", "FAIL", "exception"))

# TEST 3: Delete non-existent order (should return 404, not 500)
print("\n[TEST 3] Testing DELETE non-existent order...")
try:
    fake_id = str(uuid4())
    response = client.delete(f"/api/orders/{fake_id}")

    if response.status_code == 404:
        print("[PASS] Got 404 as expected")
        test_results.append(("DELETE non-existent order", "PASS", 404))
    elif response.status_code == 500:
        print("[FAIL] Got 500 error")
        print(f"       Response: {response.text[:200]}")
        test_results.append(("DELETE non-existent order", "FAIL", 500))
    else:
        print(f"[INFO] Got {response.status_code} (acceptable, not 500)")
        test_results.append(("DELETE non-existent order", "PASS", response.status_code))
except Exception as e:
    print(f"[FAIL] Request failed: {e}")
    test_results.append(("DELETE non-existent order", "FAIL", "exception"))

# TEST 4: Get non-existent quote (should return 404, not 500)
print("\n[TEST 4] Testing GET non-existent quote...")
try:
    fake_id = str(uuid4())
    response = client.get(f"/api/quotes/{fake_id}")

    if response.status_code == 404:
        print("[PASS] Got 404 as expected")
        test_results.append(("GET non-existent quote", "PASS", 404))
    elif response.status_code == 500:
        print("[FAIL] Got 500 error")
        print(f"       Response: {response.text[:200]}")
        test_results.append(("GET non-existent quote", "FAIL", 500))
    else:
        print(f"[INFO] Got {response.status_code} (acceptable, not 500)")
        test_results.append(("GET non-existent quote", "PASS", response.status_code))
except Exception as e:
    print(f"[FAIL] Request failed: {e}")
    test_results.append(("GET non-existent quote", "FAIL", "exception"))

# TEST 5: Update non-existent quote (should return 404, not 500)
print("\n[TEST 5] Testing PUT non-existent quote...")
try:
    fake_id = str(uuid4())
    response = client.put(
        f"/api/quotes/{fake_id}",
        json={"status": "sent"}
    )

    if response.status_code == 404:
        print("[PASS] Got 404 as expected")
        test_results.append(("PUT non-existent quote", "PASS", 404))
    elif response.status_code == 500:
        print("[FAIL] Got 500 error")
        print(f"       Response: {response.text[:200]}")
        test_results.append(("PUT non-existent quote", "FAIL", 500))
    else:
        print(f"[INFO] Got {response.status_code} (acceptable, not 500)")
        test_results.append(("PUT non-existent quote", "PASS", response.status_code))
except Exception as e:
    print(f"[FAIL] Request failed: {e}")
    test_results.append(("PUT non-existent quote", "FAIL", "exception"))

# TEST 6: Delete non-existent quote (should return 404, not 500)
print("\n[TEST 6] Testing DELETE non-existent quote...")
try:
    fake_id = str(uuid4())
    response = client.delete(f"/api/quotes/{fake_id}")

    if response.status_code == 404:
        print("[PASS] Got 404 as expected")
        test_results.append(("DELETE non-existent quote", "PASS", 404))
    elif response.status_code == 500:
        print("[FAIL] Got 500 error")
        print(f"       Response: {response.text[:200]}")
        test_results.append(("DELETE non-existent quote", "FAIL", 500))
    else:
        print(f"[INFO] Got {response.status_code} (acceptable, not 500)")
        test_results.append(("DELETE non-existent quote", "PASS", response.status_code))
except Exception as e:
    print(f"[FAIL] Request failed: {e}")
    test_results.append(("DELETE non-existent quote", "FAIL", "exception"))

# TEST 7: Invalid UUID format (should return 422, not 500)
print("\n[TEST 7] Testing invalid UUID format...")
try:
    response = client.get("/api/orders/not-a-uuid")

    if response.status_code == 422:
        print("[PASS] Got 422 (validation error) as expected")
        test_results.append(("Invalid UUID format", "PASS", 422))
    elif response.status_code == 500:
        print("[FAIL] Got 500 error")
        print(f"       Response: {response.text[:200]}")
        test_results.append(("Invalid UUID format", "FAIL", 500))
    else:
        print(f"[INFO] Got {response.status_code} (acceptable, not 500)")
        test_results.append(("Invalid UUID format", "PASS", response.status_code))
except Exception as e:
    print(f"[FAIL] Request failed: {e}")
    test_results.append(("Invalid UUID format", "FAIL", "exception"))

# TEST 8: Malformed JSON (should return 422, not 500)
print("\n[TEST 8] Testing malformed JSON...")
try:
    response = client.post(
        "/api/quotes",
        content="{invalid json",
        headers={"Content-Type": "application/json"}
    )

    if response.status_code == 422:
        print("[PASS] Got 422 (validation error) as expected")
        test_results.append(("Malformed JSON", "PASS", 422))
    elif response.status_code == 500:
        print("[FAIL] Got 500 error")
        print(f"       Response: {response.text[:200]}")
        test_results.append(("Malformed JSON", "FAIL", 500))
    else:
        print(f"[INFO] Got {response.status_code} (acceptable, not 500)")
        test_results.append(("Malformed JSON", "PASS", response.status_code))
except Exception as e:
    print(f"[FAIL] Request failed: {e}")
    test_results.append(("Malformed JSON", "FAIL", "exception"))

# Summary
print("\n" + "=" * 80)
print("TEST SUMMARY")
print("=" * 80)

passed = sum(1 for _, result, _ in test_results if result == "PASS")
failed = sum(1 for _, result, _ in test_results if result == "FAIL")

print(f"\nResults: {passed} passed, {failed} failed out of {len(test_results)} tests")
print("\nDetailed Results:")
for test_name, result, status_code in test_results:
    status_icon = "[PASS]" if result == "PASS" else "[FAIL]"
    print(f"  {status_icon} {test_name}: {status_code}")

if failed > 0:
    print("\n[FAIL] Some tests failed - 500 errors still occurring")
    print("=" * 80)
    sys.exit(1)
else:
    print("\n[SUCCESS] All tests passed - No 500 errors detected!")
    print("           All error scenarios return appropriate status codes")
    print("=" * 80)
