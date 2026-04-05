"""Warehouse operations API.

Provides the /api/warehouse/ops payload for the Warehouse Operations page,
aggregating data from orders, inventory, and containers into a single feed.
Returns realistic demo data; future versions will pull from live DB.
"""

from datetime import UTC, datetime

import structlog
from fastapi import APIRouter

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/warehouse", tags=["Warehouse"])


@router.get("/ops")
async def get_warehouse_ops() -> dict:
    """Warehouse operations payload — metrics, queues, and AI guidance.

    Aggregates receiving, pick/pack, returns, and AI insights into one feed
    for the warehouse dashboard. Demo data until full WMS integration.
    """
    now = datetime.now(UTC).isoformat()

    return {
        "updatedAt": now,
        "metrics": {
            "inboundToday": 8,
            "inboundDocked": 3,
            "inboundScheduled": 5,
            "picksDueToday": 24,
            "rushPicks": 4,
            "returnsOpen": 6,
            "returnSlaRisk": 2,
            "onTimeRate": 94,
        },
        "receivingQueue": [
            {
                "id": "PO-2026-0041",
                "supplier": "Kärcher Australia",
                "container": "MSCU1234567",
                "eta": "08:30 AM",
                "dock": "Dock A",
                "items": 48,
                "status": "in_progress",
                "priority": "high",
            },
            {
                "id": "PO-2026-0038",
                "supplier": "Tennant Company",
                "container": "CMAU9876543",
                "eta": "10:00 AM",
                "dock": "Dock B",
                "items": 32,
                "status": "scheduled",
                "priority": "normal",
            },
            {
                "id": "PO-2026-0035",
                "supplier": "Nilfisk Direct",
                "container": "TCNU5551234",
                "eta": "02:00 PM",
                "dock": "Dock C",
                "items": 16,
                "status": "scheduled",
                "priority": "normal",
            },
        ],
        "pickQueue": [
            {
                "id": "ORD-2026-0291",
                "customer": "CleanServ Pty Ltd",
                "zone": "Zone B3",
                "lines": 5,
                "promised": "Today 4 PM",
                "status": "picking",
                "priority": "rush",
            },
            {
                "id": "ORD-2026-0288",
                "customer": "BrightFloor Solutions",
                "zone": "Zone A1",
                "lines": 3,
                "promised": "Today 5 PM",
                "status": "pending",
                "priority": "high",
            },
            {
                "id": "ORD-2026-0285",
                "customer": "Hygiene Plus QLD",
                "zone": "Zone C2",
                "lines": 8,
                "promised": "Tomorrow AM",
                "status": "pending",
                "priority": "normal",
            },
            {
                "id": "ORD-2026-0282",
                "customer": "Metro Cleaning Co",
                "zone": "Zone A3",
                "lines": 2,
                "promised": "Tomorrow AM",
                "status": "pending",
                "priority": "normal",
            },
        ],
        "returnsQueue": [
            {
                "id": "RMA-2026-0019",
                "customer": "Floormaster VIC",
                "reason": "Faulty pump assembly",
                "items": 1,
                "sla": "4h remaining",
                "status": "inspection",
            },
            {
                "id": "RMA-2026-0017",
                "customer": "SparkleClean NSW",
                "reason": "Wrong item shipped",
                "items": 2,
                "sla": "24h remaining",
                "status": "pending",
            },
            {
                "id": "RMA-2026-0015",
                "customer": "Pro Hygiene WA",
                "reason": "Damaged in transit",
                "items": 3,
                "sla": "48h remaining",
                "status": "in_progress",
            },
        ],
        "aiGuidance": [
            {
                "title": "Prioritise ORD-2026-0291 pick",
                "detail": "CleanServ SLA expires at 4 PM. Assign 2 pickers to Zone B3 immediately.",
                "impact": "Prevents SLA breach — $1,800 order at risk",
            },
            {
                "title": "Dock A inspection almost done",
                "detail": "Kärcher shipment is 80% inspected. 6 items flagged for QA hold.",
                "impact": "Frees Dock A for PO-2026-0038 by 10 AM",
            },
            {
                "title": "RMA-0019 needs same-day resolution",
                "detail": "Faulty pump — customer expects replacement dispatch today.",
                "impact": "Maintains 5-star post-purchase rating",
            },
        ],
    }
