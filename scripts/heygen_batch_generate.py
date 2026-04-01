#!/usr/bin/env python3
"""
HeyGen batch video generation — CCW ERP demo suite.
24 videos across 3 tiers. Submits all jobs, polls for completion,
writes results to data/heygen/video-registry-results.json
"""

import json
import time
import urllib.request
import urllib.error
from pathlib import Path

API_KEY = "HEYGEN_API_KEY_REDACTED"
AVATAR_ID = "83a3cc2042f54a9fad9d0210ab81c9de"
VOICE_ID = "6HiVdeiuBdZbtcnukrQn"  # Luca — male English (all videos)
BASE_URL     = "https://api.heygen.com"

HEADERS = {
    "X-Api-Key": API_KEY,
    "Content-Type": "application/json",
    "Accept": "application/json",
}

# All 24 CCW demo videos — (module, title, script, duration_s, voice_id)
VIDEOS = [
    # ── Tier 1 — Core Modules ──────────────────────────────────────────────
    (
        "dashboard",
        "CCW ERP — Dashboard Overview",
        (
            "Your business runs on numbers, but right now those numbers are scattered "
            "across spreadsheets, emails, and sticky notes. CCW's dashboard pulls every "
            "critical metric into one live view — revenue today, outstanding invoices, "
            "stock alerts, and job status all in real time. "
            "You see exactly what needs attention before it becomes a problem. "
            "With CCW, your whole team works from the same single source of truth. "
            "No more morning catch-up calls asking what's happening. "
            "If a customer's order is delayed, you know it now — not tomorrow. "
            "If stock drops below reorder level, you see it before a job stalls. "
            "CCW's dashboard is built for the pace of a real trades business. "
            "Get your whole operation visible in under five minutes. "
            "Set it up today and run tomorrow with clarity."
        ),
        120,
        VOICE_ID,
    ),
    (
        "products",
        "CCW ERP — Products Walkthrough",
        (
            "Managing hundreds of SKUs in a spreadsheet is costing you time and margin. "
            "Every price update done manually is a pricing error waiting to happen. "
            "CCW's Products module gives you a searchable catalogue with live stock levels, "
            "cost price, sell price, and margin in one place. "
            "You can bulk-import from your existing spreadsheet in under ten minutes. "
            "Product variants — sizes, colours, grades — are handled natively. "
            "When stock hits your reorder threshold, the system flags it automatically. "
            "Pricing rules let you set customer-specific rates or volume discounts without "
            "manual override every time. "
            "Every product is linked to your orders, quotes, and purchase orders, "
            "so you always know what's committed and what's available. "
            "Stop losing margin to manual errors. "
            "Get your product catalogue working for you."
        ),
        120,
        VOICE_ID,
    ),
    (
        "customers",
        "CCW ERP — Customers Walkthrough",
        (
            "You have forty regular customers but you're relying on memory to know "
            "who ordered last month, who still owes you, and who's been quiet. "
            "CCW's Customers module gives you a complete profile for every account — "
            "contact details, order history, outstanding balance, and notes all in one place. "
            "Search any customer by name, phone, or account number in seconds. "
            "See their last five orders without digging through email threads. "
            "Payment terms and credit limits are visible at the point of sale, "
            "so your team never extends credit to an account that's overdue. "
            "When a customer calls with a question about their order, "
            "you have the answer before they finish the sentence. "
            "CCW turns scattered customer data into a clean, searchable record "
            "that grows with your business. "
            "Your team looks professional. Your customers stay loyal."
        ),
        120,
        VOICE_ID,
    ),
    (
        "orders",
        "CCW ERP — Orders Process Demo",
        (
            "Your orders process has too many handoffs and too much re-keying. "
            "By the time a job reaches the warehouse, something has changed. "
            "CCW's Orders module runs the full cycle — create, confirm, pick, pack, ship, invoice — "
            "without anyone retyping the same data twice. "
            "An order raised in the office is visible in the warehouse instantly. "
            "Status updates are automatic: confirmed, processing, shipped, delivered. "
            "Your customer knows where their order is without calling you. "
            "Line items pull directly from your product catalogue with live stock checks, "
            "so you never promise something you don't have. "
            "When the job ships, the invoice generates automatically. "
            "Average order processing time drops by sixty percent in the first week. "
            "Stop chasing paper. Start shipping faster."
        ),
        120,
        VOICE_ID,
    ),
    (
        "quotes",
        "CCW ERP — Quotes Workflow",
        (
            "Sending a quote in your business takes too long and wins too few jobs. "
            "CCW's Quotes module lets you build a professional quote in under three minutes. "
            "Pull products from your live catalogue, apply customer-specific pricing, "
            "add margin rules, and send a branded PDF — all without touching a spreadsheet. "
            "When the customer says yes, convert the quote to an order in one click. "
            "No re-keying. No errors. No delay. "
            "Quotes that are followed up within 24 hours win at twice the rate. "
            "CCW tracks every open quote and flags the ones that need a nudge. "
            "Your sales pipeline is visible at a glance. "
            "Quote faster, follow up smarter, close more."
        ),
        90,
        VOICE_ID,
    ),
    (
        "pos",
        "CCW ERP — Point of Sale Demo",
        (
            "Your counter sales are slow because your POS isn't connected to your stock system. "
            "You're checking spreadsheets or calling the warehouse while a customer waits. "
            "CCW's POS is built into the same system as your inventory and orders. "
            "Search a product, see live stock, take payment, and update inventory instantly. "
            "Card, cash, or account — all handled at the counter with no separate terminal. "
            "For trade account customers, their credit limit is visible before you process the sale. "
            "End-of-day reconciliation takes two minutes instead of thirty. "
            "Every counter sale flows into your reports automatically. "
            "No more end-of-week manual data entry. "
            "Faster counter service means more throughput and happier customers. "
            "Run your counter the way a modern trade business should."
        ),
        120,
        VOICE_ID,
    ),
    (
        "invoices",
        "CCW ERP — Invoices and Billing",
        (
            "Late invoices mean late payments, and late payments mean cash flow problems. "
            "CCW's Invoicing module sends invoices the moment a job is complete — "
            "automatically, with the right line items, at the right price. "
            "No more waiting for someone to process the paperwork at the end of the week. "
            "Payment status is live: paid, partial, overdue — visible at a glance. "
            "Overdue invoices are flagged automatically so you can follow up within 48 hours. "
            "Businesses that invoice same-day get paid fourteen days faster on average. "
            "CCW connects invoices directly to Xero, so your accounting is always current. "
            "No double entry. No reconciliation headaches. "
            "Get paid faster. Stay on top of cash flow."
        ),
        90,
        VOICE_ID,
    ),
    (
        "warehouse",
        "CCW ERP — Warehouse Operations",
        (
            "Your warehouse team is spending time looking for stock instead of moving it. "
            "Manual pick lists get misread, and errors reach the customer. "
            "CCW's Warehouse module gives your team digital pick lists directly from orders — "
            "accurate, prioritised, and updated in real time. "
            "When stock arrives, goods receipt is logged against the purchase order in seconds. "
            "Every movement — pick, put-away, transfer, adjustment — creates a live audit trail. "
            "Stock takes that used to take a weekend now run in a few hours. "
            "Bin locations, serial numbers, and batch codes are all tracked natively. "
            "Your inventory accuracy goes from eighty percent to ninety-eight percent "
            "within the first month. "
            "Less searching. Fewer errors. Faster fulfilment. "
            "Run a warehouse your customers can rely on."
        ),
        120,
        VOICE_ID,
    ),
    (
        "suppliers",
        "CCW ERP — Supplier Management",
        (
            "You're ordering from the same twelve suppliers but you don't have a clear record "
            "of what you ordered, what was delivered, and what's outstanding. "
            "CCW's Supplier module keeps every supplier on a single card — "
            "contact details, payment terms, lead times, and complete order history. "
            "When you need to chase a delivery, the purchase order is right there. "
            "Supplier performance is tracked automatically: on-time rate, fill rate, lead time. "
            "If a supplier's delivery performance drops below your threshold, "
            "you know before it impacts your jobs. "
            "Approved supplier lists and preferred pricing keep your buying consistent. "
            "Know exactly who you're dealing with and what they owe you. "
            "Better supplier data means better procurement decisions."
        ),
        90,
        VOICE_ID,
    ),
    (
        "purchase-orders",
        "CCW ERP — Purchase Orders",
        (
            "You're emailing purchase orders from spreadsheets and losing track of what's "
            "been ordered, what's arrived, and what's still outstanding. "
            "CCW's Purchase Orders module creates, sends, and tracks every PO in one place. "
            "Raise a PO from a stock alert, a job requirement, or a manual request — "
            "all in under two minutes. "
            "Goods receipt matches the PO automatically, flagging any discrepancies before "
            "you pay the invoice. "
            "Three-way matching — PO, receipt, invoice — means you never pay for "
            "something that didn't arrive. "
            "Your spend is visible by supplier, category, and period. "
            "Stop losing money to unmatched invoices. "
            "Control your procurement from order to receipt."
        ),
        90,
        VOICE_ID,
    ),
    (
        "contacts",
        "CCW ERP — CRM Contacts",
        (
            "Your customer relationships are stored in someone's head or worse — "
            "in an inbox that nobody else can access. "
            "CCW's CRM gives every contact a complete timeline — calls, emails, orders, "
            "quotes, and notes all in one place. "
            "When a customer calls, you see their full history before you answer. "
            "When a salesperson leaves, the relationship doesn't walk out the door with them. "
            "Activity tracking shows you which customers haven't heard from you in 30 days. "
            "That's the list you call this week. "
            "CCW's CRM is built for trades businesses — practical, fast, and linked directly "
            "to your orders and invoices. "
            "No separate CRM subscription. No double entry. "
            "Know your customers. Grow the relationship."
        ),
        90,
        VOICE_ID,
    ),
    (
        "reports",
        "CCW ERP — Reports and Analytics",
        (
            "You're running your business on gut feel because pulling a proper report "
            "takes an hour of spreadsheet work. "
            "CCW's Reports module gives you revenue, margin, stock movement, and customer "
            "spend in real time — no manual compilation required. "
            "See which products make the most margin, which customers spend the most, "
            "and which months are your biggest revenue periods. "
            "Export any report to CSV or PDF in one click. "
            "Businesses that review their numbers weekly make better buying decisions "
            "and catch cash flow problems thirty days earlier. "
            "Your reports update automatically as orders and invoices are processed. "
            "Stop making decisions without data. "
            "Run the numbers in seconds, not hours."
        ),
        90,
        VOICE_ID,
    ),
    (
        "settings",
        "CCW ERP — Settings and Configuration",
        (
            "Getting a new system up and running shouldn't require a consultant and three weeks. "
            "CCW's Settings module is built for business owners, not IT teams. "
            "Connect your Cin7 inventory, Xero accounting, and Shopify store "
            "in under fifteen minutes using API keys — no coding required. "
            "User roles and permissions let you control exactly what each team member can see. "
            "Warehouse staff see stock and orders. Accounts see invoices and payments. "
            "Managers see everything. "
            "Tax rates, payment terms, and email templates are all configurable without support tickets. "
            "CCW is designed to fit your business, not the other way around. "
            "Set up once. Run your way."
        ),
        90,
        VOICE_ID,
    ),
    (
        "integrations",
        "CCW ERP — Cin7 and Xero Integration",
        (
            "Your inventory system and your accounting system don't talk to each other, "
            "so someone is manually reconciling them every week. "
            "CCW connects Cin7 and Xero in both directions — products, stock levels, "
            "customers, invoices, and payments all sync automatically. "
            "When an order ships in CCW, the invoice appears in Xero within seconds. "
            "When stock is received from a supplier, Cin7 updates and your accounts are notified. "
            "The connection takes under ten minutes to set up with your existing API keys. "
            "No middleware. No third-party connectors. No monthly sync fees. "
            "Two integrations that used to require a full-time admin "
            "now run in the background without anyone touching them. "
            "Connect your systems. Eliminate the manual work."
        ),
        90,
        VOICE_ID,
    ),

    # ── Tier 2 — Secondary Modules ─────────────────────────────────────────
    (
        "workflows",
        "CCW ERP — Workflow Automation",
        (
            "Your team is doing the same manual tasks every day — sending follow-up emails, "
            "updating statuses, flagging overdue jobs. "
            "CCW's Workflow module automates those repetitive steps. "
            "Set a trigger — order confirmed, invoice overdue, stock below threshold — "
            "and CCW takes the action automatically. "
            "A quote that hasn't been accepted in five days sends a follow-up email without anyone "
            "remembering to do it. "
            "An overdue invoice triggers a payment reminder at day seven and day fourteen. "
            "Automation saves the average CCW user four hours per week. "
            "That's four hours back in your business every single week. "
            "Stop doing manually what a system can do automatically."
        ),
        60,
        VOICE_ID,
    ),
    (
        "workshop",
        "CCW ERP — Workshop Management",
        (
            "Your workshop runs on job cards, but those job cards are paper and they get lost. "
            "CCW's Workshop module tracks every job from intake to completion digitally. "
            "Technicians log time against the job in real time. "
            "Parts used are pulled from stock and linked to the order automatically. "
            "Customer communications — intake notes, status updates, completion photos — "
            "are all attached to the job record. "
            "Job profitability is visible: labour cost, parts cost, and margin per job, "
            "calculated automatically. "
            "Know which workshop jobs make money and which ones don't. "
            "Run your workshop like the profit centre it should be."
        ),
        60,
        VOICE_ID,
    ),
    (
        "ai-assistant",
        "CCW ERP — AI Assistant",
        (
            "Your ERP has the data but getting answers out of it still takes time. "
            "CCW's AI Assistant lets you ask business questions in plain English "
            "and get answers instantly. "
            "Ask which customers are overdue, what stock is running low, "
            "or which products had the highest margin last quarter — "
            "and get the answer in under five seconds. "
            "The AI Assistant is trained on your data, not generic business templates. "
            "It understands your products, your customers, and your pricing. "
            "For warehouse staff, it's a hands-free stock query tool. "
            "For managers, it's a real-time business analyst. "
            "No SQL. No pivot tables. No waiting for a report to run. "
            "Ask the question. Get the answer. Make the decision."
        ),
        90,
        VOICE_ID,
    ),
    (
        "marketing",
        "CCW ERP — Marketing Campaigns",
        (
            "Your best customers haven't heard from you in sixty days "
            "because you don't have time to manually run outreach. "
            "CCW's Marketing module uses your own customer data to identify who to contact, "
            "when to contact them, and what to say. "
            "Target customers who bought from you six months ago but haven't reordered. "
            "Send a campaign to everyone who requested a quote but didn't convert. "
            "Your customer list is already in CCW — use it. "
            "Businesses that run quarterly customer outreach increase repeat revenue "
            "by an average of twenty-two percent. "
            "Turn your customer data into revenue."
        ),
        60,
        VOICE_ID,
    ),
    (
        "shipments",
        "CCW ERP — Shipment Tracking",
        (
            "Your customers are calling to ask where their order is "
            "because you don't have a good answer. "
            "CCW's Shipments module tracks every outbound delivery from despatch to delivery. "
            "Carrier details, tracking numbers, and estimated delivery dates are linked "
            "directly to the order record. "
            "When a customer calls, you have the tracking number in under three seconds. "
            "Automatic status updates mean the order history shows dispatched, in transit, "
            "and delivered without anyone manually updating it. "
            "Delivery performance reports show which carriers meet your lead times "
            "and which ones don't. "
            "Know where every order is. Every time."
        ),
        60,
        VOICE_ID,
    ),
    (
        "backorders",
        "CCW ERP — Auto-Reorder",
        (
            "You're running out of stock on your top-selling lines because reordering "
            "is manual and it always gets forgotten until it's urgent. "
            "CCW's Auto-Reorder module monitors stock levels continuously. "
            "When a product drops below your reorder point, a purchase order "
            "is raised automatically to your preferred supplier. "
            "You set the reorder point and the order quantity once. "
            "CCW handles the rest. "
            "Stock-outs on key lines drop by ninety percent in the first three months. "
            "Your team stops firefighting procurement and starts working on higher-value tasks. "
            "Never run out of what your customers need."
        ),
        60,
        VOICE_ID,
    ),

    # ── Tier 3 — Cross-Cutting Videos ──────────────────────────────────────
    (
        "overview",
        "CCW ERP — Platform Overview",
        (
            "Most trades businesses run on a patchwork of tools that don't connect. "
            "A spreadsheet for inventory. An accounting package for invoices. "
            "A whiteboard for jobs. A phone for customer follow-up. "
            "Every gap between those tools is a place where data gets lost, "
            "errors creep in, and time gets wasted. "
            "CCW is a single platform built for equipment suppliers and trade businesses "
            "that need everything connected. "
            "Products, stock, customers, orders, quotes, invoices, warehouse operations, "
            "purchasing, and reporting — all in one system, talking to each other in real time. "
            "When an order is placed, stock is reserved, the warehouse is notified, "
            "the invoice is prepared, and the supplier is flagged if stock needs replenishing. "
            "All automatically. All connected. "
            "CCW integrates natively with Cin7 for inventory, Xero for accounting, "
            "and Shopify for e-commerce — so your existing tools can stay in place "
            "while CCW becomes the backbone that connects them. "
            "Businesses that move to an integrated ERP reduce admin time by forty percent "
            "in the first ninety days. "
            "That's not a forecast. That's what CCW customers report. "
            "If you're still managing your business in disconnected tools, "
            "the cost is real — you're paying it in time, errors, and missed opportunities. "
            "CCW gives you the infrastructure of a large operation "
            "at a price that works for a growing business. "
            "Get your whole business running in one place."
        ),
        180,
        VOICE_ID,
    ),
    (
        "tradies",
        "CCW ERP — Why CCW for Tradies",
        (
            "Generic business software isn't built for trades. "
            "It doesn't understand job cards, stock on the truck, trade accounts, "
            "or the chaos of a busy workshop. "
            "CCW is built specifically for equipment suppliers and trade businesses. "
            "The workflows match the way you actually work — "
            "not the way a software consultant thinks you should. "
            "Counter sales that update stock instantly. "
            "Job cards that track labour and parts automatically. "
            "Purchase orders that raise themselves when stock runs low. "
            "Quotes that convert to orders in one click. "
            "CCW customers in the trades sector report saving eight to twelve hours "
            "of admin per week within the first month. "
            "That's time you get back to spend on jobs, customers, and growth. "
            "If your current system is slowing you down, "
            "it's time to use one that was built for you."
        ),
        120,
        VOICE_ID,
    ),
    (
        "vs-spreadsheets",
        "CCW ERP — CCW vs Spreadsheets",
        (
            "Your business has outgrown spreadsheets, but switching feels like a big commitment. "
            "Here's what spreadsheets actually cost you. "
            "Every time two people edit the same file, you risk a version conflict. "
            "Every manual entry is a potential error. "
            "Every report you need requires someone to compile it. "
            "Spreadsheets don't send automatic reminders, track stock in real time, "
            "or connect your sales to your accounting. "
            "CCW does all of that — and it's live, shared, and accurate. "
            "The average business running on spreadsheets spends fifteen hours per week "
            "on tasks that CCW handles automatically. "
            "At any reasonable hourly rate, that's your entire CCW subscription cost "
            "recovered in the first week of every month. "
            "The question isn't whether you can afford CCW. "
            "It's whether you can afford to keep running on spreadsheets."
        ),
        90,
        VOICE_ID,
    ),
    (
        "integration-story",
        "CCW ERP — The Integration Story",
        (
            "The most powerful thing about CCW isn't any single feature. "
            "It's the way everything connects. "
            "Your Cin7 inventory syncs with CCW in real time — "
            "stock levels, product data, customer records, all bidirectional. "
            "When you raise an order in CCW, Cin7 knows about it immediately. "
            "When stock arrives in Cin7, CCW updates automatically. "
            "Xero receives every invoice and payment without anyone touching the accounting. "
            "Your Shopify store shows live stock levels because CCW and Cin7 are in sync. "
            "No batch syncs. No overnight updates. No manual reconciliation. "
            "CCW acts as the operational brain that keeps your entire stack aligned. "
            "Businesses running this three-way integration — CCW, Cin7, and Xero — "
            "report that they've eliminated the equivalent of one full-time admin role "
            "in reconciliation and data entry. "
            "That's the value of connected systems. "
            "Set up the integration once. Let it run."
        ),
        120,
        VOICE_ID,
    ),
]


def generate_video(module: str, title: str, script: str, width: int = 1280, height: int = 720) -> str | None:
    payload = {
        "video_inputs": [{
            "character": {
                "type": "avatar",
                "avatar_id": AVATAR_ID,
                "avatar_style": "normal",
            },
            "voice": {
                "type": "text",
                "voice_id": VOICE_ID,
                "input_text": script,
            },
            "background": {
                "type": "color",
                "value": "#FFFFFF",
            },
        }],
        "dimension": {"width": width, "height": height},
        "title": title,
    }
    req = urllib.request.Request(
        f"{BASE_URL}/v2/video/generate",
        data=json.dumps(payload).encode(),
        headers=HEADERS,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.loads(r.read())
    except urllib.error.HTTPError as e:
        print(f"  ERROR {e.code}: {e.read().decode()[:200]}")
        return None
    if data.get("error"):
        print(f"  ERROR: {data['error']}")
        return None
    video_id = data["data"]["video_id"]
    print(f"  Submitted: {video_id}")
    return video_id


def poll_status(video_id: str, max_attempts: int = 40, interval: int = 30) -> dict:
    for attempt in range(1, max_attempts + 1):
        req = urllib.request.Request(
            f"{BASE_URL}/v1/video_status.get?video_id={video_id}",
            headers=HEADERS,
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                raw = json.loads(r.read())
        except Exception as e:
            print(f"  Poll error: {e}")
            time.sleep(interval)
            continue
        data = raw.get("data") or raw
        status = data.get("status", "unknown")
        print(f"  [{attempt}/{max_attempts}] {video_id[:12]}... status={status}")
        if status == "completed":
            return {"status": "completed", "video_url": data.get("video_url"), "thumbnail_url": data.get("thumbnail_url")}
        if status in ("failed", "error"):
            return {"status": "failed", "error": data.get("error")}
        time.sleep(interval)
    return {"status": "timeout"}


def main():
    results_path = Path(__file__).parent.parent / "data" / "heygen" / "video-registry-results.json"
    results_path.parent.mkdir(parents=True, exist_ok=True)

    # Load any existing results to resume
    existing: dict = {}
    if results_path.exists():
        existing = json.loads(results_path.read_text())

    jobs: list[dict] = []

    print(f"\n{'='*60}")
    print(f"SUBMITTING {len(VIDEOS)} VIDEO JOBS")
    print(f"{'='*60}\n")

    for module, title, script, duration_s, voice_id in VIDEOS:
        if module in existing and existing[module].get("video_id"):
            vid = existing[module]["video_id"]
            print(f"[SKIP] {module} — already submitted ({vid[:12]}...)")
            jobs.append({"module": module, "title": title, "video_id": vid, "duration": duration_s})
            continue

        print(f"[SUBMIT] {module} — {title}")
        video_id = generate_video(module, title, script)
        if video_id:
            jobs.append({"module": module, "title": title, "video_id": video_id, "duration": duration_s})
            existing[module] = {"video_id": video_id, "status": "processing", "title": title}
            results_path.write_text(json.dumps(existing, indent=2))
        time.sleep(3)  # Brief pause between submissions

    print(f"\n{'='*60}")
    print(f"ALL JOBS SUBMITTED. POLLING FOR COMPLETION...")
    print(f"{'='*60}\n")

    for job in jobs:
        module = job["module"]
        video_id = job["video_id"]
        if existing.get(module, {}).get("status") == "completed":
            print(f"[DONE] {module} already completed")
            continue

        print(f"\n[POLL] {module} ({video_id[:12]}...)")
        result = poll_status(video_id)
        existing[module].update(result)
        results_path.write_text(json.dumps(existing, indent=2))
        print(f"  >> {result['status']}" + (f" | {result.get('video_url','')[:60]}" if result.get('video_url') else ""))

    print(f"\n{'='*60}")
    print("COMPLETE")
    completed = [m for m, v in existing.items() if v.get("status") == "completed"]
    failed = [m for m, v in existing.items() if v.get("status") == "failed"]
    print(f"Completed: {len(completed)}/{len(VIDEOS)}")
    if failed:
        print(f"Failed: {failed}")
    print(f"Results: {results_path}")
    print(f"{'='*60}\n")

    # Print all video URLs
    print("\nVIDEO URLS:")
    for module, v in existing.items():
        url = v.get("video_url", "—")
        print(f"  {module:25s} {url}")


if __name__ == "__main__":
    main()
