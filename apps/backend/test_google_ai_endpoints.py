"""Test Google AI API endpoints directly."""
import asyncio
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

# Load environment variables
from dotenv import load_dotenv
env_path = Path(__file__).parent.parent.parent / ".env.local"
load_dotenv(env_path)


async def test_endpoints():
    """Test all Google AI endpoints."""
    from fastapi.testclient import TestClient
    from src.api.main import app

    client = TestClient(app)

    print("\n" + "=" * 60)
    print("Google AI API Endpoints Test")
    print("=" * 60 + "\n")

    # Test 1: Health endpoint
    print("[TEST 1] GET /api/google-ai/health")
    try:
        response = client.get("/api/google-ai/health")
        print(f"  Status: {response.status_code}")
        print(f"  Response: {response.json()}")
        if response.status_code == 200:
            data = response.json()
            if data.get("configured") and data.get("status") == "ready":
                print("  [PASS] Health check successful\n")
            else:
                print("  [FAIL] Google AI not configured\n")
        else:
            print("  [FAIL] Unexpected status code\n")
    except Exception as e:
        print(f"  [FAIL] {str(e)}\n")

    # Test 2: Text generation
    print("[TEST 2] POST /api/google-ai/generate")
    try:
        response = client.post(
            "/api/google-ai/generate",
            json={
                "prompt": "Say 'Google AI is working!' in exactly 5 words.",
                "temperature": 0.3,
                "max_tokens": 20,
            }
        )
        print(f"  Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"  Generated text: {data.get('text')}")
            print(f"  Model used: {data.get('model')}")
            print(f"  Prompt length: {data.get('prompt_length')}")
            print(f"  Response length: {data.get('response_length')}")
            print("  [PASS] Text generation successful\n")
        else:
            print(f"  Response: {response.json()}")
            print("  [FAIL] Text generation failed\n")
    except Exception as e:
        print(f"  [FAIL] {str(e)}\n")

    # Test 3: Product description
    print("[TEST 3] POST /api/google-ai/product-description")
    try:
        response = client.post(
            "/api/google-ai/product-description",
            json={
                "product_name": "Industrial Drill Press",
                "product_category": "Power Tools",
                "key_features": ["Heavy-duty", "Variable speed", "Precision drilling"],
                "target_audience": "Professional contractors",
                "tone": "professional"
            }
        )
        print(f"  Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"  Product: {data.get('product_name')}")
            print(f"  Description length: {len(data.get('description', ''))}")
            print(f"  Description preview: {data.get('description', '')[:100]}...")
            print(f"  Model used: {data.get('model_used')}")
            print("  [PASS] Product description generation successful\n")
        else:
            print(f"  Response: {response.json()}")
            print("  [FAIL] Product description failed\n")
    except Exception as e:
        print(f"  [FAIL] {str(e)}\n")

    # Test 4: Embeddings
    print("[TEST 4] POST /api/google-ai/embeddings")
    try:
        response = client.post(
            "/api/google-ai/embeddings",
            json={
                "texts": ["Industrial equipment", "Construction tools", "Safety gear"],
                "model": "models/gemini-embedding-001"
            }
        )
        print(f"  Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"  Embeddings count: {data.get('count')}")
            print(f"  Embedding dimension: {data.get('dimension')}")
            print(f"  First embedding preview: [{data.get('embeddings', [[]])[0][:3]}...]")
            print("  [PASS] Embeddings generation successful\n")
        else:
            print(f"  Response: {response.json()}")
            print("  [FAIL] Embeddings failed\n")
    except Exception as e:
        print(f"  [FAIL] {str(e)}\n")

    print("=" * 60)
    print("All endpoint tests completed!")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    asyncio.run(test_endpoints())
