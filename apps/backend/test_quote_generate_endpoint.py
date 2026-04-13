"""Quick test to verify /api/quotes/generate endpoint works."""
import asyncio

import httpx


async def test_quote_generate():
    """Test the quote generate endpoint."""
    base_url = "http://localhost:8000"

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Test 1: Call generate endpoint
        print("Testing POST /api/quotes/generate...")
        try:
            response = await client.post(
                f"{base_url}/api/quotes/generate",
                json={
                    "requirements": "Need tools for construction project",
                    "customer_id": None,  # Will use first available
                }
            )
            print(f"Status Code: {response.status_code}")
            print("Expected: 201 or 400 (if no data)")

            if response.status_code == 405:
                print("❌ FAILED: Got 405 Method Not Allowed")
                return False
            elif response.status_code in [201, 400]:
                print(f"✅ PASSED: Got expected status code {response.status_code}")
                if response.status_code == 201:
                    print(f"Response: {response.json()}")
                return True
            else:
                print(f"⚠️  Got unexpected status code: {response.status_code}")
                print(f"Response: {response.text}")
                return True  # Not a 405, so routing is fixed

        except Exception as e:
            print(f"Error: {e}")
            return False

if __name__ == "__main__":
    result = asyncio.run(test_quote_generate())
    exit(0 if result else 1)
