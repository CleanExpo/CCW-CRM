"""Single-video upload against YouTube Data API v3 (UNI-1933)."""

from __future__ import annotations

import os
from pathlib import Path

# Video metadata catalog — one entry per module key (matches MP4 stem).
VIDEO_METADATA: dict[str, dict[str, str]] = {
    "dashboard":          {"title": "CCW ERP — Dashboard Overview",         "desc": "A walkthrough of the CCW ERP dashboard — live metrics, KPIs, and quick-access modules for your equipment supply business."},
    "products":           {"title": "CCW ERP — Products & Catalogue",       "desc": "Manage your full product catalogue in CCW ERP — SKUs, pricing, stock levels, categories and barcode scanning."},
    "customers":          {"title": "CCW ERP — Customer Management",        "desc": "CRM module walkthrough — customer profiles, contact history, order activity and segmentation."},
    "orders":             {"title": "CCW ERP — Orders & Fulfilment",        "desc": "Process sales orders end-to-end in CCW ERP — create, confirm, pick, pack, ship and track."},
    "quotes":             {"title": "CCW ERP — Quoting Workflow",           "desc": "Build and send professional quotes in seconds. Convert approved quotes directly to orders."},
    "pos":                {"title": "CCW ERP — Point of Sale",              "desc": "Walk-in counter sales made simple. CCW POS handles transactions, receipts and stock deduction in real-time."},
    "invoices":           {"title": "CCW ERP — Invoicing & Billing",        "desc": "Generate invoices from orders, track payment status, handle partial payments and sync to Xero."},
    "warehouse":          {"title": "CCW ERP — Warehouse Operations",       "desc": "Manage stock locations, receive goods against purchase orders, and run stocktakes with barcode scanning."},
    "suppliers":          {"title": "CCW ERP — Supplier Management",        "desc": "Manage your supplier database, pricing agreements, lead times and contact details."},
    "purchase-orders":    {"title": "CCW ERP — Purchase Orders",            "desc": "Raise POs, track approvals, receive stock against POs and auto-reorder when stock hits minimums."},
    "contacts":           {"title": "CCW ERP — Contacts & CRM",             "desc": "Full contact management — individuals, companies, activity timeline and relationship health scoring."},
    "reports":            {"title": "CCW ERP — Reports & Analytics",        "desc": "Built-in reporting for sales, inventory, purchasing and financials. Export to CSV or PDF."},
    "settings":           {"title": "CCW ERP — Settings & Configuration",   "desc": "System settings — users, roles, tax rates, warehouses and global preferences."},
    "integrations":       {"title": "CCW ERP — Cin7 & Xero Integration",    "desc": "Connect CCW ERP to Cin7 Core for inventory sync and Xero for accounting — real-time bidirectional."},
    "workflows":          {"title": "CCW ERP — Workflow Automation",        "desc": "Build automated workflows with triggers, conditions and actions. Reduce manual work across every module."},
    "workshop":           {"title": "CCW ERP — Workshop Management",        "desc": "Job cards, technician scheduling, parts tracking and workshop billing all in one place."},
    "ai-assistant":       {"title": "CCW ERP — AI Assistant",               "desc": "Ask natural language questions about your business — stock levels, order status, revenue forecasts and more."},
    "marketing":          {"title": "CCW ERP — Marketing Campaigns",        "desc": "Manage email campaigns, customer segments and track campaign performance from within CCW."},
    "shipments":          {"title": "CCW ERP — Shipment Tracking",          "desc": "Track outbound shipments, manage carriers, print labels and notify customers automatically."},
    "backorders":         {"title": "CCW ERP — Backorder & Auto-Reorder",   "desc": "Manage backorders intelligently — auto-reorder rules, supplier allocation and customer notifications."},
    "overview":           {"title": "CCW ERP — Platform Overview",          "desc": "A complete overview of the CCW ERP system — who it's for, what it does, and why it's built for Australian equipment suppliers."},
    "tradies":            {"title": "Why CCW ERP for Tradies",              "desc": "Purpose-built for trades businesses — see how CCW ERP solves the real problems that spreadsheets can't."},
    "vs-spreadsheets":    {"title": "CCW ERP vs Spreadsheets",              "desc": "Side-by-side comparison — why growing equipment suppliers outgrow spreadsheets and what CCW ERP gives you instead."},
    "integration-story":  {"title": "The CCW ERP Integration Story",        "desc": "How CCW ERP connects your entire operation — Cin7, Xero, your warehouse, your team and your customers."},
    "first-look":         {"title": "CCW ERP — First Look: Your Complete Equipment Operations System", "desc": "A first look at CCW ERP CRM — the complete operating system for Australian equipment suppliers. See all 14 modules: products, orders, customers, warehouse, invoicing, AI assistant and more. Built for trades businesses who are ready to move beyond spreadsheets."},
    "connections-guide":  {"title": "CCW ERP — Connections Setup Guide: Shopify & Xero (Under 10 Minutes)", "desc": "Step-by-step guide to connecting your Shopify store and Xero accounting to CCW ERP. CCW manages all infrastructure — you only need to connect your two accounts. Be live in under 10 minutes."},
}

TAGS = [
    "CCW ERP",
    "equipment supplier",
    "inventory management",
    "Australia",
    "trades business",
    "Cin7",
    "Xero",
    "ERP software",
    "CCW",
    "business software",
]

CHANNEL_ID = os.environ.get("YOUTUBE_CHANNEL_ID", "UChN8nQFig73BoefyMBIsN-w")


def upload_video(youtube, module: str, mp4_path: Path) -> str | None:
    """Upload a single video. Returns YouTube video ID or None on failure.

    Uses resumable chunked upload. On transient failures the call delegates
    to :func:`scripts.youtube.throttle.retry_with_backoff` so a single bad
    chunk does not abort the whole job.
    """
    from googleapiclient.http import MediaFileUpload

    from .throttle import retry_with_backoff

    meta = VIDEO_METADATA.get(module, {})
    title = meta.get("title", f"CCW ERP — {module.replace('-', ' ').title()}")
    desc = meta.get("desc", f"CCW ERP demo video — {module}")
    desc_full = f"{desc}\n\n#CCWERP #EquipmentSupplier #Australia #Trades"

    body = {
        "snippet": {
            "title": title,
            "description": desc_full,
            "tags": TAGS,
            "categoryId": "28",  # Science & Technology
            "defaultLanguage": "en-AU",
        },
        "status": {
            "privacyStatus": "private",  # Internal training — private
            "selfDeclaredMadeForKids": False,
        },
    }

    media = MediaFileUpload(
        str(mp4_path), chunksize=-1, resumable=True, mimetype="video/mp4"
    )

    print(f"  Uploading: {title}", flush=True)
    request = youtube.videos().insert(
        part=",".join(body.keys()), body=body, media_body=media
    )

    response = None
    while response is None:
        try:
            status_obj, response = retry_with_backoff(
                request.next_chunk, label=f"next_chunk({module})"
            )
            if status_obj:
                pct = int(status_obj.progress() * 100)
                print(f"  Progress: {pct}%", end="\r", flush=True)
        except Exception:
            # Retry budget exhausted — treat as failed upload.
            return None

    video_id = response.get("id") if response else None
    if video_id:
        print(f"\n  OK — https://youtu.be/{video_id}")
    return video_id
