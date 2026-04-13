"""Phase 5 test runner — runs outside pytest to avoid conftest.py deps."""

import ast
import hashlib
import hmac
import os
import sys
from datetime import UTC, datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

# Import cin7_webhooks directly to avoid integrations/__init__.py import chain
# which pulls in xero → database → psycopg2
import importlib.util as _ilu

from src.integrations.cin7.change_detector import (
    detect_customer_changes,
    detect_inventory_changes,
    detect_product_changes,
    detect_sales_changes,
    format_modified_since,
    format_modified_since_omni,
)
from src.integrations.cin7.event_dispatcher import (
    ALL_CIN7_EVENTS,
    CIN7_EVENT_CUSTOMER_CHANGED,
    CIN7_EVENT_INVENTORY_CHANGED,
    CIN7_EVENT_POLL_COMPLETED,
    CIN7_EVENT_PRODUCT_CHANGED,
    CIN7_EVENT_SALES_CHANGED,
    CIN7_EVENT_SYNC_COMPLETED,
    CIN7_EVENT_SYNC_FAILED,
    CIN7_SSE_CHANNEL,
    build_customer_event,
    build_inventory_event,
    build_poll_summary_event,
    build_product_event,
    build_sales_event,
    build_sync_result_event,
)

_wh_spec = _ilu.spec_from_file_location(
    "cin7_webhooks",
    os.path.join(
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")),
        "src", "api", "routes", "integrations", "cin7_webhooks.py",
    ),
)
_wh_mod = _ilu.module_from_spec(_wh_spec)
_wh_spec.loader.exec_module(_wh_mod)

CIN7_WEBHOOK_EVENT_MAP = _wh_mod.CIN7_WEBHOOK_EVENT_MAP
route_webhook_event = _wh_mod.route_webhook_event
verify_cin7_signature = _wh_mod.verify_cin7_signature

passed = 0
failed = 0


def check(desc, condition):
    global passed, failed
    if condition:
        passed += 1
    else:
        failed += 1
        print(f"FAIL: {desc}")


# ============================================================
# format_modified_since (Core)
# ============================================================

dt_utc = datetime(2025, 11, 15, 8, 30, 45, tzinfo=UTC)
check("core format basic", format_modified_since(dt_utc) == "2025-11-15T08:30:45")

dt_naive = datetime(2025, 6, 1, 12, 0, 0)
check("core format naive", format_modified_since(dt_naive) == "2025-06-01T12:00:00")

dt_midnight = datetime(2025, 1, 1, 0, 0, 0, tzinfo=UTC)
check("core format midnight", format_modified_since(dt_midnight) == "2025-01-01T00:00:00")

# ============================================================
# format_modified_since_omni
# ============================================================

check("omni format basic", format_modified_since_omni(dt_utc) == "2025-11-15T08:30:45Z")
check("omni format naive", format_modified_since_omni(dt_naive) == "2025-06-01T12:00:00Z")
check("omni format midnight", format_modified_since_omni(dt_midnight) == "2025-01-01T00:00:00Z")

# ============================================================
# detect_product_changes — Core
# ============================================================

CORE_PRODUCTS = [
    {"ID": "prod-001", "SKU": "EX-001", "Name": "Excavator 320"},
    {"ID": "prod-002", "SKU": "DR-002", "Name": "Impact Drill"},
]

p_events = detect_product_changes(CORE_PRODUCTS, "core")
check("core products count", len(p_events) == 2)
check("core product entity_type", p_events[0]["entity_type"] == "product")
check("core product entity_id", p_events[0]["entity_id"] == "prod-001")
check("core product name", p_events[0]["name"] == "Excavator 320")
check("core product action", p_events[0]["action"] == "updated")
check("core product source", p_events[0]["source"] == "core")

# detect_product_changes — Omni
OMNI_PRODUCTS = [
    {"id": 10001, "styleCode": "EX-001", "description": "Excavator 320"},
]

p_omni = detect_product_changes(OMNI_PRODUCTS, "omni")
check("omni product entity_id", p_omni[0]["entity_id"] == "10001")
check("omni product name", p_omni[0]["name"] == "Excavator 320")

# Empty
check("empty products", len(detect_product_changes([], "core")) == 0)

# ============================================================
# detect_customer_changes — Core
# ============================================================

CORE_CUSTOMERS = [
    {"ID": "cust-001", "Name": "QLD Civil Construction"},
]

c_events = detect_customer_changes(CORE_CUSTOMERS, "core")
check("core customer count", len(c_events) == 1)
check("core customer entity_id", c_events[0]["entity_id"] == "cust-001")
check("core customer name", c_events[0]["name"] == "QLD Civil Construction")

# Omni
OMNI_CUSTOMERS = [{"id": 20001, "company": "Sydney Metro Builders"}]
c_omni = detect_customer_changes(OMNI_CUSTOMERS, "omni")
check("omni customer entity_id", c_omni[0]["entity_id"] == "20001")
check("omni customer name", c_omni[0]["name"] == "Sydney Metro Builders")

check("empty customers", len(detect_customer_changes([], "core")) == 0)

# ============================================================
# detect_sales_changes — Core
# ============================================================

CORE_SALES = [
    {"SaleID": "sale-001", "OrderNumber": "SO-2025-001", "Status": "Ordered"},
]

s_events = detect_sales_changes(CORE_SALES, "core")
check("core sales count", len(s_events) == 1)
check("core sales entity_id", s_events[0]["entity_id"] == "sale-001")
check("core sales reference", s_events[0]["reference"] == "SO-2025-001")
check("core sales status", s_events[0]["status"] == "Ordered")

# Omni
OMNI_SALES = [{"id": 30001, "reference": "SO-001", "status": "Dispatched"}]
s_omni = detect_sales_changes(OMNI_SALES, "omni")
check("omni sales entity_id", s_omni[0]["entity_id"] == "30001")

check("empty sales", len(detect_sales_changes([], "core")) == 0)

# ============================================================
# detect_inventory_changes — Core
# ============================================================

CORE_INVENTORY = [
    {"ProductID": "prod-001", "SKU": "EX-001", "Location": "Brisbane Warehouse", "Available": 5},
]

i_events = detect_inventory_changes(CORE_INVENTORY, "core")
check("core inv count", len(i_events) == 1)
check("core inv entity_id", i_events[0]["entity_id"] == "prod-001")
check("core inv location", i_events[0]["location"] == "Brisbane Warehouse")
check("core inv available", i_events[0]["available"] == 5)
check("core inv action", i_events[0]["action"] == "stock_changed")

# Omni
OMNI_INVENTORY = [{"id": 10001, "branchName": "Sydney Branch", "stockAvailable": 12}]
i_omni = detect_inventory_changes(OMNI_INVENTORY, "omni")
check("omni inv entity_id", i_omni[0]["entity_id"] == "10001")

check("empty inventory", len(detect_inventory_changes([], "core")) == 0)

# ============================================================
# Event type constants
# ============================================================

check("event count", len(ALL_CIN7_EVENTS) == 7)
check("product event value", CIN7_EVENT_PRODUCT_CHANGED == "cin7.product.changed")
check("sync completed value", CIN7_EVENT_SYNC_COMPLETED == "cin7.sync.completed")
check("sse channel", CIN7_SSE_CHANNEL == "cin7-sync")

# ============================================================
# build_product_event
# ============================================================

pe = build_product_event({"entity_id": "prod-001", "name": "Excavator"}, "core", "created")
check("build pe event_type", pe["event_type"] == CIN7_EVENT_PRODUCT_CHANGED)
check("build pe entity_id", pe["entity_id"] == "prod-001")
check("build pe name", pe["name"] == "Excavator")
check("build pe action", pe["action"] == "created")
check("build pe has timestamp", "timestamp" in pe)

# ============================================================
# build_customer_event
# ============================================================

ce = build_customer_event({"entity_id": "cust-001", "name": "QLD Civil"}, "omni")
check("build ce event_type", ce["event_type"] == CIN7_EVENT_CUSTOMER_CHANGED)
check("build ce source", ce["source"] == "omni")
check("build ce action", ce["action"] == "updated")
check("build ce entity_id", ce["entity_id"] == "cust-001")

# ============================================================
# build_sales_event
# ============================================================

se = build_sales_event(
    {"entity_id": "sale-001", "reference": "SO-001", "status": "Ordered"}, "core"
)
check("build se event_type", se["event_type"] == CIN7_EVENT_SALES_CHANGED)
check("build se reference", se["reference"] == "SO-001")
check("build se status", se["status"] == "Ordered")
check("build se source", se["source"] == "core")

# ============================================================
# build_inventory_event
# ============================================================

ie = build_inventory_event(
    {"entity_id": "prod-001", "location": "Brisbane", "available": 5}, "core"
)
check("build ie event_type", ie["event_type"] == CIN7_EVENT_INVENTORY_CHANGED)
check("build ie location", ie["location"] == "Brisbane")
check("build ie available", ie["available"] == 5)
check("build ie action", ie["action"] == "stock_changed")

# ============================================================
# build_sync_result_event
# ============================================================

sre_ok = build_sync_result_event("products", "completed", 42)
check("sync result completed", sre_ok["event_type"] == CIN7_EVENT_SYNC_COMPLETED)
check("sync result records", sre_ok["records_processed"] == 42)
check("sync result status", sre_ok["status"] == "completed")

sre_fail = build_sync_result_event("customers", "failed", 0, "API timeout")
check("sync result failed type", sre_fail["event_type"] == CIN7_EVENT_SYNC_FAILED)
check("sync result error", sre_fail["error"] == "API timeout")
check("sync result failed status", sre_fail["status"] == "failed")

# ============================================================
# build_poll_summary_event
# ============================================================

pse = build_poll_summary_event(["products", "customers"], 15, 2500)
check("poll summary event_type", pse["event_type"] == CIN7_EVENT_POLL_COMPLETED)
check("poll summary entities", pse["entity_types"] == ["products", "customers"])
check("poll summary changes", pse["changes_detected"] == 15)
check("poll summary duration", pse["duration_ms"] == 2500)

# ============================================================
# verify_cin7_signature
# ============================================================

secret = "test_secret_key"
payload = b'{"event_type":"product.updated","data":{}}'
valid_sig = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()

check("sig valid", verify_cin7_signature(payload, valid_sig, secret) is True)
check("sig invalid", verify_cin7_signature(payload, "bad_signature", secret) is False)
check("sig empty sig", verify_cin7_signature(payload, "", secret) is False)
check("sig empty secret", verify_cin7_signature(payload, valid_sig, "") is False)

# ============================================================
# route_webhook_event
# ============================================================

check("route product.updated", route_webhook_event("product.updated") == CIN7_EVENT_PRODUCT_CHANGED)
check("route order.created", route_webhook_event("order.created") == CIN7_EVENT_SALES_CHANGED)
check("route inventory.updated", route_webhook_event("inventory.updated") == CIN7_EVENT_INVENTORY_CHANGED)
check("route unknown", route_webhook_event("unknown.type") is None)
check("webhook event map count", len(CIN7_WEBHOOK_EVENT_MAP) == 8)

# ============================================================
# AST verification — cin7_webhooks.py endpoints
# ============================================================

_backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
with open(os.path.join(_backend_dir, "src", "api", "routes", "integrations", "cin7_webhooks.py")) as fh:
    tree_wh = ast.parse(fh.read())

wh_funcs = [n.name for n in ast.walk(tree_wh) if isinstance(n, ast.AsyncFunctionDef)]
for expected in [
    "receive_cin7_webhook",
    "get_cin7_webhook_status",
    "test_cin7_webhook",
]:
    check(f"wh endpoint {expected}", expected in wh_funcs)

# ============================================================
# AST verification — cin7_stream.py endpoints
# ============================================================

with open(os.path.join(_backend_dir, "src", "api", "routes", "integrations", "cin7_stream.py")) as fh:
    tree_st = ast.parse(fh.read())

st_funcs = [n.name for n in ast.walk(tree_st) if isinstance(n, ast.AsyncFunctionDef)]
for expected in [
    "cin7_sync_stream",
    "get_cin7_stream_stats",
    "publish_test_cin7_event",
    "trigger_cin7_poll",
    "get_cin7_poll_status",
]:
    check(f"stream endpoint {expected}", expected in st_funcs)


print(f"Phase 5 Webhooks + Real-time tests: {passed} passed, {failed} failed")
sys.exit(1 if failed > 0 else 0)
