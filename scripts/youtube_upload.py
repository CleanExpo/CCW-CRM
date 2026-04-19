"""CCW YouTube Bulk Uploader — backward-compatible shim (UNI-1933).

The implementation now lives in the ``scripts.youtube`` package
(auth / upload / throttle / schedule). This file preserves the existing
CRON + CLI contract so callers using

    python scripts/youtube_upload.py --auth
    python scripts/youtube_upload.py --upload
    python scripts/youtube_upload.py --status
    python scripts/youtube_upload.py --patch-only

continue to work unchanged.

ENV (optional overrides):
    YOUTUBE_CHANNEL_ID   — default: UChN8nQFig73BoefyMBIsN-w
    YOUTUBE_PLAYLIST_ID  — if you want videos added to a playlist
"""

from __future__ import annotations

import sys
from pathlib import Path

# Make the package importable when this file is run via
# ``python scripts/youtube_upload.py`` (no ``scripts.youtube`` on path).
_THIS_DIR = Path(__file__).resolve().parent
if str(_THIS_DIR) not in sys.path:
    sys.path.insert(0, str(_THIS_DIR))

from youtube.schedule import main  # noqa: E402

# Re-exports for anything that imported the monolithic module directly.
from youtube.auth import get_authenticated_service  # noqa: E402, F401
from youtube.schedule import (  # noqa: E402, F401
    cmd_auth,
    cmd_patch_only,
    cmd_status,
    cmd_upload,
    update_demo_video_banner,
    update_video_registry,
)
from youtube.upload import TAGS, VIDEO_METADATA, upload_video  # noqa: E402, F401


if __name__ == "__main__":
    main()
