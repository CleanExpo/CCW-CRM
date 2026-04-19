"""Batch upload scheduling + registry patching + CLI (UNI-1933).

Owns the orchestration concerns:
- Scheduling: choosing which MP4s to upload next and spacing requests.
- Resume safety: persisting progress to ``UPLOAD_LOG`` after each success.
- Patching: updating ``video-registry.json`` and ``DemoVideoBanner.tsx`` once
  the batch finishes.
- CLI commands: ``--auth``, ``--upload``, ``--status``, ``--patch-only``.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path

from .auth import get_authenticated_service
from .upload import VIDEO_METADATA, upload_video

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DOWNLOADS_DIR = REPO_ROOT / "data" / "heygen" / "downloads"
REGISTRY_FILE = REPO_ROOT / "data" / "heygen" / "video-registry.json"
RESULTS_FILE = REPO_ROOT / "data" / "heygen" / "video-registry-results.json"
BANNER_FILE = REPO_ROOT / "apps" / "web" / "components" / "dashboard" / "DemoVideoBanner.tsx"
UPLOAD_LOG = REPO_ROOT / "data" / "heygen" / "youtube-upload-log.json"

INTER_UPLOAD_DELAY_SECONDS = 2


def update_video_registry(upload_log: dict) -> None:
    """Update ``data/heygen/video-registry.json`` with YouTube IDs."""
    with open(REGISTRY_FILE) as fh:
        registry = json.load(fh)

    for video in registry["videos"]:
        module = video["module"]
        if module in upload_log:
            yt_id = upload_log[module]["youtubeId"]
            video["youtubeId"] = yt_id
            video["youtubeUrl"] = f"https://youtu.be/{yt_id}"
            video["status"] = "published"

    with open(REGISTRY_FILE, "w") as fh:
        json.dump(registry, fh, indent=2)
    print(f"Updated {REGISTRY_FILE}")


def update_demo_video_banner(upload_log: dict) -> None:
    """Patch ``apps/web/components/dashboard/DemoVideoBanner.tsx`` with YouTube IDs."""
    if not BANNER_FILE.exists():
        print(f"WARN: {BANNER_FILE} not found — skipping banner update")
        return

    content = BANNER_FILE.read_text(encoding="utf-8")
    patched = 0
    for module, data in upload_log.items():
        yt_id = data.get("youtubeId")
        if not yt_id:
            continue
        pattern = (
            rf'(route:\s*["\'](?:[^"\']*?{re.escape(module)}[^"\']*?)["\'][^}}]*?youtubeId:\s*)null'
        )
        replacement = rf'\g<1>"{yt_id}"'
        new_content, n = re.subn(pattern, replacement, content, flags=re.DOTALL)
        if n > 0:
            content = new_content
            patched += 1

    BANNER_FILE.write_text(content, encoding="utf-8")
    print(f"Patched {patched} YouTube IDs in DemoVideoBanner.tsx")


def _load_upload_log() -> dict:
    if UPLOAD_LOG.exists():
        with open(UPLOAD_LOG) as fh:
            return json.load(fh)
    return {}


def _save_upload_log(log: dict) -> None:
    UPLOAD_LOG.parent.mkdir(parents=True, exist_ok=True)
    with open(UPLOAD_LOG, "w") as fh:
        json.dump(log, fh, indent=2)


def cmd_upload(args: argparse.Namespace | None = None) -> None:
    """Upload all pending videos. Resume-safe; skips anything already uploaded."""
    upload_log = _load_upload_log()

    mp4_files = sorted(DOWNLOADS_DIR.glob("*.mp4"))
    if not mp4_files:
        print(f"ERROR: No MP4 files found in {DOWNLOADS_DIR}")
        sys.exit(1)

    print(f"\nFound {len(mp4_files)} MP4 files to upload")

    pending = [f for f in mp4_files if f.stem not in upload_log]
    already_done = len(mp4_files) - len(pending)
    if already_done:
        print(f"Skipping {already_done} already-uploaded videos")

    if not pending:
        print("All videos already uploaded!")
    else:
        youtube = get_authenticated_service()
        print(f"\nUploading {len(pending)} videos as Unlisted...\n")

        for mp4 in pending:
            module = mp4.stem
            print(f"\n[{module}]")
            yt_id = upload_video(youtube, module, mp4)
            if yt_id:
                upload_log[module] = {
                    "youtubeId": yt_id,
                    "youtubeUrl": f"https://youtu.be/{yt_id}",
                    "title": VIDEO_METADATA.get(module, {}).get("title", module),
                    "uploadedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                }
                _save_upload_log(upload_log)
            else:
                print("  FAILED — will retry on next run")

            if mp4 != pending[-1]:
                time.sleep(INTER_UPLOAD_DELAY_SECONDS)

    print(f"\n{'=' * 60}")
    print(f"Upload complete: {len(upload_log)}/{len(mp4_files)} videos")
    print(f"{'=' * 60}")
    for module, data in upload_log.items():
        print(f"  {module:<25} {data['youtubeId']}")

    if upload_log:
        print("\nUpdating registry and banner...")
        update_video_registry(upload_log)
        update_demo_video_banner(upload_log)
        print(
            "\nAll done. Run: git add -A && git commit -m "
            "'feat: add YouTube IDs for 24 demo videos'"
        )


def cmd_auth(args: argparse.Namespace | None = None) -> None:
    """Trigger OAuth flow to save token."""
    print("Opening browser for YouTube OAuth authorization...")
    get_authenticated_service()
    print("Authorization complete. Token saved.")


def cmd_status(args: argparse.Namespace | None = None) -> None:
    """Show upload status."""
    if UPLOAD_LOG.exists():
        with open(UPLOAD_LOG) as fh:
            log = json.load(fh)
        mp4_files = list(DOWNLOADS_DIR.glob("*.mp4"))
        print(f"\nUploaded: {len(log)}/{len(mp4_files)}")
        for module, data in log.items():
            print(f"  {module:<25} https://youtu.be/{data['youtubeId']}")
        pending = [f.stem for f in mp4_files if f.stem not in log]
        if pending:
            print(f"\nPending ({len(pending)}): {', '.join(pending)}")
    else:
        print("No uploads yet. Run: python scripts/youtube_upload.py --upload")


def cmd_patch_only(args: argparse.Namespace | None = None) -> None:
    """Just patch DemoVideoBanner.tsx from the existing upload log (no upload)."""
    if not UPLOAD_LOG.exists():
        print("ERROR: No upload log found. Run --upload first.")
        sys.exit(1)
    with open(UPLOAD_LOG) as fh:
        log = json.load(fh)
    update_video_registry(log)
    update_demo_video_banner(log)


def main() -> None:
    """CLI entry point — preserves the pre-UNI-1933 argument contract."""
    parser = argparse.ArgumentParser(description="CCW YouTube bulk uploader")
    parser.add_argument("--auth", action="store_true", help="Authorize YouTube OAuth (one-time)")
    parser.add_argument("--upload", action="store_true", help="Upload all pending videos")
    parser.add_argument("--status", action="store_true", help="Show upload status")
    parser.add_argument(
        "--patch-only",
        action="store_true",
        help="Only patch registry + banner from existing log",
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="List what would upload without uploading"
    )
    parser.add_argument("--channel", help="YouTube channel ID override (informational)")
    args = parser.parse_args()

    if args.dry_run:
        log = _load_upload_log()
        mp4_files = sorted(DOWNLOADS_DIR.glob("*.mp4"))
        pending = [f.stem for f in mp4_files if f.stem not in log]
        print(f"DRY RUN — would upload {len(pending)} videos: {', '.join(pending) or 'none'}")
        return

    if args.auth:
        cmd_auth(args)
    elif args.upload:
        cmd_upload(args)
    elif args.status:
        cmd_status(args)
    elif args.patch_only:
        cmd_patch_only(args)
    else:
        parser.print_help()
