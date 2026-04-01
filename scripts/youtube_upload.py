"""
CCW YouTube Bulk Uploader — YouTube Data API v3
================================================
Uploads all 24 HeyGen demo videos to YouTube as Unlisted,
records video IDs, then patches DemoVideoBanner.tsx + video-registry.json.

SETUP (one time):
  1. Go to https://console.cloud.google.com
  2. Create project → Enable "YouTube Data API v3"
  3. Create OAuth2 credentials (Desktop App type)
  4. Download as: scripts/youtube_oauth_client.json
  5. Run: python scripts/youtube_upload.py --auth
     (Opens browser once — approve, tokens saved locally)
  6. Run: python scripts/youtube_upload.py --upload

ENV (optional overrides):
  YOUTUBE_CHANNEL_ID   — default: UCLqS3mSp4DflzZd9IILXLdQ
  YOUTUBE_PLAYLIST_ID  — if you want videos added to a playlist
"""

import os
import sys
import json
import time
import argparse
import re
from pathlib import Path

# ── Config ──────────────────────────────────────────────────────────────────
REPO_ROOT = Path(__file__).parent.parent
DOWNLOADS_DIR = REPO_ROOT / "data" / "heygen" / "downloads"
REGISTRY_FILE = REPO_ROOT / "data" / "heygen" / "video-registry.json"
RESULTS_FILE  = REPO_ROOT / "data" / "heygen" / "video-registry-results.json"
BANNER_FILE   = REPO_ROOT / "apps" / "web" / "components" / "dashboard" / "DemoVideoBanner.tsx"
OAUTH_CREDS   = REPO_ROOT / "scripts" / "youtube_oauth_client.json"
TOKEN_FILE    = REPO_ROOT / "scripts" / ".youtube_token.json"
UPLOAD_LOG    = REPO_ROOT / "data" / "heygen" / "youtube-upload-log.json"

CHANNEL_ID = os.environ.get("YOUTUBE_CHANNEL_ID", "UCLqS3mSp4DflzZd9IILXLdQ")
SCOPES = ["https://www.googleapis.com/auth/youtube.upload",
          "https://www.googleapis.com/auth/youtube"]

# Video metadata per module
VIDEO_METADATA = {
    "dashboard":        {"title": "CCW ERP — Dashboard Overview",         "desc": "A walkthrough of the CCW ERP dashboard — live metrics, KPIs, and quick-access modules for your equipment supply business."},
    "products":         {"title": "CCW ERP — Products & Catalogue",       "desc": "Manage your full product catalogue in CCW ERP — SKUs, pricing, stock levels, categories and barcode scanning."},
    "customers":        {"title": "CCW ERP — Customer Management",        "desc": "CRM module walkthrough — customer profiles, contact history, order activity and segmentation."},
    "orders":           {"title": "CCW ERP — Orders & Fulfilment",        "desc": "Process sales orders end-to-end in CCW ERP — create, confirm, pick, pack, ship and track."},
    "quotes":           {"title": "CCW ERP — Quoting Workflow",           "desc": "Build and send professional quotes in seconds. Convert approved quotes directly to orders."},
    "pos":              {"title": "CCW ERP — Point of Sale",              "desc": "Walk-in counter sales made simple. CCW POS handles transactions, receipts and stock deduction in real-time."},
    "invoices":         {"title": "CCW ERP — Invoicing & Billing",        "desc": "Generate invoices from orders, track payment status, handle partial payments and sync to Xero."},
    "warehouse":        {"title": "CCW ERP — Warehouse Operations",       "desc": "Manage stock locations, receive goods against purchase orders, and run stocktakes with barcode scanning."},
    "suppliers":        {"title": "CCW ERP — Supplier Management",        "desc": "Manage your supplier database, pricing agreements, lead times and contact details."},
    "purchase-orders":  {"title": "CCW ERP — Purchase Orders",           "desc": "Raise POs, track approvals, receive stock against POs and auto-reorder when stock hits minimums."},
    "contacts":         {"title": "CCW ERP — Contacts & CRM",            "desc": "Full contact management — individuals, companies, activity timeline and relationship health scoring."},
    "reports":          {"title": "CCW ERP — Reports & Analytics",       "desc": "Built-in reporting for sales, inventory, purchasing and financials. Export to CSV or PDF."},
    "settings":         {"title": "CCW ERP — Settings & Configuration",  "desc": "System settings — users, roles, tax rates, warehouses and global preferences."},
    "integrations":     {"title": "CCW ERP — Cin7 & Xero Integration",   "desc": "Connect CCW ERP to Cin7 Core for inventory sync and Xero for accounting — real-time bidirectional."},
    "workflows":        {"title": "CCW ERP — Workflow Automation",       "desc": "Build automated workflows with triggers, conditions and actions. Reduce manual work across every module."},
    "workshop":         {"title": "CCW ERP — Workshop Management",       "desc": "Job cards, technician scheduling, parts tracking and workshop billing all in one place."},
    "ai-assistant":     {"title": "CCW ERP — AI Assistant",             "desc": "Ask natural language questions about your business — stock levels, order status, revenue forecasts and more."},
    "marketing":        {"title": "CCW ERP — Marketing Campaigns",       "desc": "Manage email campaigns, customer segments and track campaign performance from within CCW."},
    "shipments":        {"title": "CCW ERP — Shipment Tracking",         "desc": "Track outbound shipments, manage carriers, print labels and notify customers automatically."},
    "backorders":       {"title": "CCW ERP — Backorder & Auto-Reorder",  "desc": "Manage backorders intelligently — auto-reorder rules, supplier allocation and customer notifications."},
    "overview":         {"title": "CCW ERP — Platform Overview",         "desc": "A complete overview of the CCW ERP system — who it's for, what it does, and why it's built for Australian equipment suppliers."},
    "tradies":          {"title": "Why CCW ERP for Tradies",             "desc": "Purpose-built for trades businesses — see how CCW ERP solves the real problems that spreadsheets can't."},
    "vs-spreadsheets":  {"title": "CCW ERP vs Spreadsheets",            "desc": "Side-by-side comparison — why growing equipment suppliers outgrow spreadsheets and what CCW ERP gives you instead."},
    "integration-story":{"title": "The CCW ERP Integration Story",       "desc": "How CCW ERP connects your entire operation — Cin7, Xero, your warehouse, your team and your customers."},
    # Remotion walkthrough videos
    "first-look":       {"title": "CCW ERP — First Look: Your Complete Equipment Operations System", "desc": "A first look at CCW ERP CRM — the complete operating system for Australian equipment suppliers. See all 14 modules: products, orders, customers, warehouse, invoicing, AI assistant and more. Built for trades businesses who are ready to move beyond spreadsheets."},
    "connections-guide":{"title": "CCW ERP — Connections Setup Guide: Shopify & Xero (Under 10 Minutes)", "desc": "Step-by-step guide to connecting your Shopify store and Xero accounting to CCW ERP. CCW manages all infrastructure — you only need to connect your two accounts. Be live in under 10 minutes."},
}

TAGS = ["CCW ERP", "equipment supplier", "inventory management", "Australia", "trades business",
        "Cin7", "Xero", "ERP software", "CCW", "business software"]


# ── Auth ─────────────────────────────────────────────────────────────────────

def get_authenticated_service():
    """Return an authenticated YouTube API service object."""
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
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
                print("  2. APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID")
                print("  3. Application type: Desktop app")
                print("  4. Download JSON and save to: scripts/youtube_oauth_client.json")
                sys.exit(1)
            flow = InstalledAppFlow.from_client_secrets_file(str(OAUTH_CREDS), SCOPES)
            creds = flow.run_local_server(port=0)

        with open(TOKEN_FILE, "w") as f:
            f.write(creds.to_json())
        print(f"Token saved to {TOKEN_FILE}")

    return build("youtube", "v3", credentials=creds)


# ── Upload ────────────────────────────────────────────────────────────────────

def upload_video(youtube, module: str, mp4_path: Path) -> str | None:
    """Upload a single video. Returns YouTube video ID or None on failure."""
    from googleapiclient.http import MediaFileUpload

    meta = VIDEO_METADATA.get(module, {})
    title = meta.get("title", f"CCW ERP — {module.replace('-', ' ').title()}")
    desc = meta.get("desc", f"CCW ERP demo video — {module}")
    desc_full = f"{desc}\n\n#CCWERP #EquipmentSupplier #Australia #Trades"

    body = {
        "snippet": {
            "title": title,
            "description": desc_full,
            "tags": TAGS,
            "categoryId": "28",          # Science & Technology
            "defaultLanguage": "en-AU",
        },
        "status": {
            "privacyStatus": "private",   # Internal training — private
            "selfDeclaredMadeForKids": False,
        },
    }

    media = MediaFileUpload(str(mp4_path), chunksize=-1, resumable=True,
                            mimetype="video/mp4")

    print(f"  Uploading: {title}", flush=True)
    request = youtube.videos().insert(part=",".join(body.keys()), body=body, media_body=media)

    response = None
    retries = 0
    while response is None:
        try:
            status, response = request.next_chunk()
            if status:
                pct = int(status.progress() * 100)
                print(f"  Progress: {pct}%", end="\r", flush=True)
        except Exception as e:
            retries += 1
            if retries > 5:
                print(f"\n  ERROR after 5 retries: {e}")
                return None
            wait = 2 ** retries
            print(f"\n  Retry {retries}/5 in {wait}s: {e}")
            time.sleep(wait)

    video_id = response.get("id")
    print(f"\n  OK — https://youtu.be/{video_id}")
    return video_id


# ── Patch files ───────────────────────────────────────────────────────────────

def update_video_registry(upload_log: dict):
    """Update data/heygen/video-registry.json with YouTube IDs."""
    with open(REGISTRY_FILE) as f:
        registry = json.load(f)

    for video in registry["videos"]:
        module = video["module"]
        if module in upload_log:
            yt_id = upload_log[module]["youtubeId"]
            video["youtubeId"] = yt_id
            video["youtubeUrl"] = f"https://youtu.be/{yt_id}"
            video["status"] = "published"

    with open(REGISTRY_FILE, "w") as f:
        json.dump(registry, f, indent=2)
    print(f"Updated {REGISTRY_FILE}")


def update_demo_video_banner(upload_log: dict):
    """Patch apps/web/components/dashboard/DemoVideoBanner.tsx with YouTube IDs."""
    if not BANNER_FILE.exists():
        print(f"WARN: {BANNER_FILE} not found — skipping banner update")
        return

    content = BANNER_FILE.read_text(encoding="utf-8")

    patched = 0
    for module, data in upload_log.items():
        yt_id = data.get("youtubeId")
        if not yt_id:
            continue

        # Replace: route: "/dashboard/module-name", ... youtubeId: null
        # With:    route: "/dashboard/module-name", ... youtubeId: "VIDEO_ID"
        pattern = rf'(route:\s*["\'](?:[^"\']*?{re.escape(module)}[^"\']*?)["\'][^}}]*?youtubeId:\s*)null'
        replacement = rf'\g<1>"{yt_id}"'
        new_content, n = re.subn(pattern, replacement, content, flags=re.DOTALL)
        if n > 0:
            content = new_content
            patched += 1

    BANNER_FILE.write_text(content, encoding="utf-8")
    print(f"Patched {patched} YouTube IDs in DemoVideoBanner.tsx")


# ── Main ──────────────────────────────────────────────────────────────────────

def cmd_upload(args):
    """Upload all pending videos."""
    # Load existing upload log
    upload_log = {}
    if UPLOAD_LOG.exists():
        with open(UPLOAD_LOG) as f:
            upload_log = json.load(f)

    # Get list of modules to upload
    mp4_files = sorted(DOWNLOADS_DIR.glob("*.mp4"))
    if not mp4_files:
        print(f"ERROR: No MP4 files found in {DOWNLOADS_DIR}")
        sys.exit(1)

    print(f"\nFound {len(mp4_files)} MP4 files to upload")

    # Filter: skip already uploaded
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
                # Save after each upload (resume-safe)
                UPLOAD_LOG.parent.mkdir(parents=True, exist_ok=True)
                with open(UPLOAD_LOG, "w") as f:
                    json.dump(upload_log, f, indent=2)
            else:
                print(f"  FAILED — will retry on next run")

            # Small delay between uploads
            if mp4 != pending[-1]:
                time.sleep(2)

    # Print summary
    print(f"\n{'='*60}")
    print(f"Upload complete: {len(upload_log)}/{len(mp4_files)} videos")
    print(f"{'='*60}")
    for module, data in upload_log.items():
        print(f"  {module:<25} {data['youtubeId']}")

    # Patch files
    if upload_log:
        print("\nUpdating registry and banner...")
        update_video_registry(upload_log)
        update_demo_video_banner(upload_log)
        print("\nAll done. Run: git add -A && git commit -m 'feat: add YouTube IDs for 24 demo videos'")


def cmd_auth(args):
    """Trigger OAuth flow to save token."""
    print("Opening browser for YouTube OAuth authorization...")
    get_authenticated_service()
    print("Authorization complete. Token saved.")


def cmd_status(args):
    """Show upload status."""
    if UPLOAD_LOG.exists():
        with open(UPLOAD_LOG) as f:
            log = json.load(f)
        mp4_files = list(DOWNLOADS_DIR.glob("*.mp4"))
        print(f"\nUploaded: {len(log)}/{len(mp4_files)}")
        for module, data in log.items():
            print(f"  {module:<25} https://youtu.be/{data['youtubeId']}")
        pending = [f.stem for f in mp4_files if f.stem not in log]
        if pending:
            print(f"\nPending ({len(pending)}): {', '.join(pending)}")
    else:
        print("No uploads yet. Run: python scripts/youtube_upload.py --upload")


def cmd_patch_only(args):
    """Just patch DemoVideoBanner.tsx from existing upload log (no upload)."""
    if not UPLOAD_LOG.exists():
        print("ERROR: No upload log found. Run --upload first.")
        sys.exit(1)
    with open(UPLOAD_LOG) as f:
        log = json.load(f)
    update_video_registry(log)
    update_demo_video_banner(log)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CCW YouTube bulk uploader")
    parser.add_argument("--auth",       action="store_true", help="Authorize YouTube OAuth (one-time)")
    parser.add_argument("--upload",     action="store_true", help="Upload all pending videos")
    parser.add_argument("--status",     action="store_true", help="Show upload status")
    parser.add_argument("--patch-only", action="store_true", help="Only patch registry + banner from existing log")
    args = parser.parse_args()

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
