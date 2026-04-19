"""CCW YouTube uploader package (UNI-1933).

Modularised from the original ``scripts/youtube_upload.py`` monolith so
each concern is independently testable. The thin shim at
``scripts/youtube_upload.py`` preserves the existing CRON + CLI contract:
any caller using ``python scripts/youtube_upload.py --upload|--auth|
--status|--patch-only`` continues to work unchanged.

Module layout:

- :mod:`scripts.youtube.auth`     — OAuth2 flow and token caching.
- :mod:`scripts.youtube.upload`   — single-video upload against YouTube Data API v3.
- :mod:`scripts.youtube.throttle` — exponential-backoff retry helper.
- :mod:`scripts.youtube.schedule` — batch-upload orchestration + file patching + CLI commands.
"""

from .auth import get_authenticated_service  # noqa: F401
from .schedule import cmd_auth, cmd_patch_only, cmd_status, cmd_upload, main  # noqa: F401
from .upload import upload_video  # noqa: F401
