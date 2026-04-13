"""Debug Google AI response structure."""
import asyncio
import os
from pathlib import Path

from dotenv import load_dotenv

# Load environment
env_path = Path(__file__).parent.parent.parent / ".env.local"
load_dotenv(env_path)

async def debug_response():
    """Debug the response structure from Google AI."""
    from google import genai

    api_key = os.getenv("GOOGLE_AI_API_KEY")
    if not api_key:
        print("ERROR: GOOGLE_AI_API_KEY not set")
        return

    client = genai.Client(api_key=api_key)

    print("\nGenerating content...")
    response = await client.aio.models.generate_content(
        model="models/gemini-2.5-flash",
        contents="Say hello in 3 words",
    )

    print("\n" + "=" * 60)
    print("Response Object Structure:")
    print("=" * 60)
    print(f"Type: {type(response)}")
    print(f"Dir: {[attr for attr in dir(response) if not attr.startswith('_')]}")

    # Check for text attribute
    if hasattr(response, 'text'):
        print(f"\nresponse.text: {response.text!r}")
    else:
        print("\nNo 'text' attribute")

    # Check for candidates
    if hasattr(response, 'candidates'):
        print(f"\nresponse.candidates: {response.candidates}")
        if response.candidates:
            candidate = response.candidates[0]
            print(f"  Candidate type: {type(candidate)}")
            print(f"  Candidate dir: {[attr for attr in dir(candidate) if not attr.startswith('_')]}")

            if hasattr(candidate, 'content'):
                content = candidate.content
                print(f"\n  Content type: {type(content)}")
                print(f"  Content dir: {[attr for attr in dir(content) if not attr.startswith('_')]}")

                if hasattr(content, 'parts'):
                    parts = content.parts
                    print(f"\n  Parts: {parts}")
                    if parts:
                        part = parts[0]
                        print(f"    Part type: {type(part)}")
                        print(f"    Part dir: {[attr for attr in dir(part) if not attr.startswith('_')]}")
                        if hasattr(part, 'text'):
                            print(f"    Part.text: {part.text!r}")

if __name__ == "__main__":
    asyncio.run(debug_response())
