"""YouTube OAuth2 flow + token cache (UNI-1933)."""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
OAUTH_CREDS = REPO_ROOT / "scripts" / "youtube_oauth_client.json"
TOKEN_FILE = REPO_ROOT / "scripts" / ".youtube_token.json"

SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube",
]


def get_authenticated_service():
    """Return an authenticated YouTube API service object.

    Loads a cached refresh token from :data:`TOKEN_FILE` when available,
    falls back to an interactive OAuth flow using the downloaded
    ``youtube_oauth_client.json`` credentials.
    """
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build

    creds = None
    if TOKEN_FILE.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not OAUTH_CREDS.exists():
                print(f"\nERROR: OAuth credentials file not found at:\n  {OAUTH_CREDS}")
                print("\nTo create it:")
                print("  1. Go to https://console.cloud.google.com")
                print(
                    "  2. APIs & Services → Credentials → Create Credentials"
                    " → OAuth 2.0 Client ID"
                )
                print("  3. Application type: Desktop app")
                print(
                    "  4. Download JSON and save to: scripts/youtube_oauth_client.json"
                )
                sys.exit(1)
            flow = InstalledAppFlow.from_client_secrets_file(str(OAUTH_CREDS), SCOPES)
            creds = flow.run_local_server(port=0)

        with open(TOKEN_FILE, "w") as fh:
            fh.write(creds.to_json())
        print(f"Token saved to {TOKEN_FILE}")

    return build("youtube", "v3", credentials=creds)
