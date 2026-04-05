"""List available Google AI models."""
import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment
env_path = Path(__file__).parent.parent.parent / ".env.local"
load_dotenv(env_path)

async def list_models():
    """List available Google AI models."""
    from google import genai

    api_key = os.getenv("GOOGLE_AI_API_KEY")
    if not api_key:
        print("ERROR: GOOGLE_AI_API_KEY not set")
        return

    client = genai.Client(api_key=api_key)

    print("\nAvailable Google AI Models:")
    print("=" * 60)

    try:
        models = await client.aio.models.list()
        for model in models:
            print(f"\nModel: {model.name}")
            if hasattr(model, 'display_name'):
                print(f"  Display Name: {model.display_name}")
            if hasattr(model, 'description'):
                print(f"  Description: {model.description[:100] if model.description else 'N/A'}")
            if hasattr(model, 'supported_generation_methods'):
                print(f"  Methods: {', '.join(model.supported_generation_methods)}")
    except Exception as e:
        print(f"Error listing models: {e}")

if __name__ == "__main__":
    asyncio.run(list_models())
