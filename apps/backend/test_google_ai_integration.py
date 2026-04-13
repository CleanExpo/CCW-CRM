"""
Test Google AI Integration

This script verifies that the Google AI API key is configured correctly
and can successfully make API calls to Google's Gemini models.

Usage:
    python test_google_ai_integration.py

Requirements:
    - GOOGLE_AI_API_KEY environment variable must be set
    - google-generativeai package must be installed
"""

import asyncio
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

# Load environment variables from .env.local
import os

from dotenv import load_dotenv

# Load .env.local file from project root
project_root = Path(__file__).parent.parent.parent
env_path = project_root / ".env.local"
if env_path.exists():
    load_dotenv(env_path)
    print(f"[INFO] Loaded environment from: {env_path}")
    # Verify the key was loaded
    if os.getenv("GOOGLE_AI_API_KEY"):
        print("[INFO] GOOGLE_AI_API_KEY is set")
    else:
        print("[WARNING] GOOGLE_AI_API_KEY not found in environment")
else:
    print(f"[WARNING] .env.local not found at: {env_path}")
    print("[INFO] Attempting to load from default .env")
    load_dotenv()


async def test_google_ai_client():
    """Test Google AI client initialization and basic functionality."""
    print("\n" + "=" * 60)
    print("Google AI Integration Test")
    print("=" * 60 + "\n")

    try:
        # Test 1: Import and initialize client
        print("[TEST 1] Importing Google AI client...")
        from src.integrations.google import get_google_ai_client

        print("[PASS] Successfully imported Google AI client\n")

        # Test 2: Get client instance
        print("[TEST 2] Initializing Google AI client...")
        try:
            client = get_google_ai_client()
            print("[PASS] Client initialized successfully")
            print(f"        Default model: {client.config.default_model}")
            print(f"        Max retries: {client.config.max_retries}")
            print(f"        Timeout: {client.config.timeout_seconds}s\n")
        except ValueError as e:
            print(f"[FAIL] {str(e)}")
            print("\nPlease set GOOGLE_AI_API_KEY in your .env file")
            print("Get your API key from: https://makersuite.google.com/app/apikey\n")
            return False

        # Test 3: Text generation
        print("[TEST 3] Testing text generation...")
        try:
            response = await client.generate_text(
                prompt="Say 'Hello from Google AI!' in exactly 5 words.",
                temperature=0.3,
                max_tokens=50,
            )
            print("[PASS] Text generation successful")
            print(f"        Response: {response['text'][:100]}")
            print(f"        Model used: {response['model']}\n")
        except Exception as e:
            print(f"[FAIL] Text generation failed: {str(e)}\n")
            return False

        # Test 4: Embeddings generation
        print("[TEST 4] Testing embeddings generation...")
        try:
            embeddings = await client.generate_embeddings(
                texts=["test product 1", "test product 2"],
            )
            print("[PASS] Embeddings generation successful")
            print(f"        Generated {len(embeddings)} embeddings")
            print(f"        Dimension: {len(embeddings[0]) if embeddings else 0}\n")
        except Exception as e:
            print(f"[FAIL] Embeddings generation failed: {str(e)}\n")
            return False

        # Test 5: Convenience function
        print("[TEST 5] Testing convenience function...")
        try:
            from src.integrations.google import generate_text_with_google

            text = await generate_text_with_google(
                prompt="What is 2+2? Answer in one word.",
                temperature=0.0,
                max_tokens=10,
            )
            print("[PASS] Convenience function works")
            print(f"        Response: {text}\n")
        except Exception as e:
            print(f"[FAIL] Convenience function failed: {str(e)}\n")
            return False

        # All tests passed
        print("=" * 60)
        print("[SUCCESS] All Google AI integration tests passed!")
        print("=" * 60)
        print("\nYour Google AI API key is configured correctly and working.")
        print("\nNext steps:")
        print("  1. Restart your backend server to load the new configuration")
        print("  2. Test the API endpoints:")
        print("     - GET  /api/google-ai/health")
        print("     - POST /api/google-ai/generate")
        print("     - POST /api/google-ai/product-description")
        print("     - POST /api/google-ai/embeddings")
        print()
        return True

    except Exception as e:
        print(f"\n[FATAL ERROR] {str(e)}")
        import traceback

        traceback.print_exc()
        return False


async def test_api_endpoints():
    """Test API endpoints are registered correctly."""
    print("\n" + "=" * 60)
    print("API Endpoints Verification")
    print("=" * 60 + "\n")

    try:
        from src.api.main import app

        # Check if Google AI routes are registered
        routes = [route.path for route in app.routes]
        google_ai_routes = [r for r in routes if "google-ai" in r]

        if google_ai_routes:
            print(f"[PASS] Found {len(google_ai_routes)} Google AI routes:")
            for route in google_ai_routes:
                print(f"        {route}")
            print()
            return True
        else:
            print("[FAIL] No Google AI routes found in application")
            print("       Make sure google_ai router is included in main.py\n")
            return False

    except Exception as e:
        print(f"[FAIL] Could not verify API routes: {str(e)}\n")
        return False


async def main():
    """Run all tests."""
    # Test 1: Google AI client functionality
    client_ok = await test_google_ai_client()

    # Test 2: API endpoints registration
    endpoints_ok = await test_api_endpoints()

    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    print(f"  Google AI Client:  {'[PASS]' if client_ok else '[FAIL]'}")
    print(f"  API Endpoints:     {'[PASS]' if endpoints_ok else '[FAIL]'}")
    print("=" * 60 + "\n")

    if client_ok and endpoints_ok:
        print("[SUCCESS] Google AI integration is fully operational!\n")
        sys.exit(0)
    else:
        print("[FAILURE] Some tests failed. Please review the errors above.\n")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
