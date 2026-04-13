"""Phase 4 test runner — runs outside pytest to avoid conftest.py deps."""

import ast
import os
import sys
from datetime import UTC, datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from src.integrations.cin7.purchase_sync import (
    CIN7_CORE_PO_STATUS,
    CIN7_OMNI_PO_STATUS,
    ERP_TO_CIN7_CORE_PO_STATUS,
    ERP_TO_CIN7_OMNI_PO_STATUS,
    Cin7PurchaseSyncer,
    generate_po_number,
    map_cin7_core_po_status,
    map_cin7_omni_po_status,
    map_erp_po_to_core,
    map_erp_po_to_omni,
)
from src.integrations.cin7.supplier_sync import (
    extract_core_supplier_fields,
    generate_supplier_code,
    map_erp_supplier_to_core,
    map_erp_supplier_to_omni,
)

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
# Supplier field extraction (Core)
# ============================================================

CORE_SUPPLIER = {
    "ID": "sup-001-uuid",
    "Name": "Caterpillar Australia",
    "Currency": "AUD",
    "PaymentTerm": "60 days",
    "TaxRule": "GST on Purchases",
    "Status": "Active",
}

f = extract_core_supplier_fields(CORE_SUPPLIER)
check("supplier company_name", f["company_name"] == "Caterpillar Australia")
check("supplier payment_terms", f["payment_terms"] == "60 days")
check("supplier is_active true", f["is_active"] is True)

inactive_sup = {**CORE_SUPPLIER, "Status": "Inactive"}
check("supplier is_active false", extract_core_supplier_fields(inactive_sup)["is_active"] is False)

# ============================================================
# Supplier code generation
# ============================================================

check("supplier code core", generate_supplier_code("sup-001-uuid", "core") == "CIN7-S-sup-001-")
check("supplier code long", generate_supplier_code("abcdefghijklmnop", "omni") == "CIN7-S-abcdefgh")
check("supplier code short", generate_supplier_code("123", "core") == "CIN7-S-123")

# ============================================================
# Core PO status mapping
# ============================================================

check("core po draft", map_cin7_core_po_status("Draft") == "draft")
check("core po ordered", map_cin7_core_po_status("Ordered") == "ordered")
check("core po received", map_cin7_core_po_status("Received") == "received")
check("core po voided", map_cin7_core_po_status("Voided") == "cancelled")
check("core po unknown", map_cin7_core_po_status("SomeNew") == "draft")
check("core po 4 statuses", len(CIN7_CORE_PO_STATUS) == 4)

# ============================================================
# Omni PO status mapping
# ============================================================

check("omni po new", map_cin7_omni_po_status("New") == "draft")
check("omni po ordered", map_cin7_omni_po_status("Ordered") == "ordered")
check("omni po received", map_cin7_omni_po_status("Received") == "received")
check("omni po cancelled", map_cin7_omni_po_status("Cancelled") == "cancelled")
check("omni po unknown", map_cin7_omni_po_status("Unknown") == "draft")
check("omni po 4 statuses", len(CIN7_OMNI_PO_STATUS) == 4)

# ============================================================
# ERP → Core reverse status mapping (all 7 ERP states)
# ============================================================

check("erp→core draft", ERP_TO_CIN7_CORE_PO_STATUS["draft"] == "Draft")
check("erp→core pending_approval", ERP_TO_CIN7_CORE_PO_STATUS["pending_approval"] == "Draft")
check("erp→core approved", ERP_TO_CIN7_CORE_PO_STATUS["approved"] == "Draft")
check("erp→core ordered", ERP_TO_CIN7_CORE_PO_STATUS["ordered"] == "Ordered")
check("erp→core in_transit", ERP_TO_CIN7_CORE_PO_STATUS["in_transit"] == "Ordered")
check("erp→core received", ERP_TO_CIN7_CORE_PO_STATUS["received"] == "Received")
check("erp→core cancelled", ERP_TO_CIN7_CORE_PO_STATUS["cancelled"] == "Voided")

# ============================================================
# ERP → Omni reverse status mapping (all 7 ERP states)
# ============================================================

check("erp→omni draft", ERP_TO_CIN7_OMNI_PO_STATUS["draft"] == "New")
check("erp→omni pending_approval", ERP_TO_CIN7_OMNI_PO_STATUS["pending_approval"] == "New")
check("erp→omni approved", ERP_TO_CIN7_OMNI_PO_STATUS["approved"] == "New")
check("erp→omni ordered", ERP_TO_CIN7_OMNI_PO_STATUS["ordered"] == "Ordered")
check("erp→omni in_transit", ERP_TO_CIN7_OMNI_PO_STATUS["in_transit"] == "Ordered")
check("erp→omni received", ERP_TO_CIN7_OMNI_PO_STATUS["received"] == "Received")
check("erp→omni cancelled", ERP_TO_CIN7_OMNI_PO_STATUS["cancelled"] == "Cancelled")

# ============================================================
# PO number generation
# ============================================================

check("po num core", generate_po_number("PO-2025-001", "core") == "C7C-PO-2025-001")
check("po num omni", generate_po_number("PO-2025-001", "omni") == "C7O-PO-2025-001")

# ============================================================
# ERP → Core PO payload
# ============================================================


class FakePO:
    po_number = "PO-2025-001"
    status = "ordered"
    total = 420000.00
    order_date = datetime(2025, 11, 15, tzinfo=UTC)


p = map_erp_po_to_core(FakePO())
check("core po payload number", p["PurchaseOrderNumber"] == "PO-2025-001")
check("core po payload status", p["Status"] == "Ordered")
check("core po payload total", p["Total"] == 420000.00)
check("core po payload date", p["OrderDate"] == "2025-11-15")

# ============================================================
# ERP → Omni PO payload
# ============================================================

p2 = map_erp_po_to_omni(FakePO())
check("omni po payload ref", p2["reference"] == "PO-2025-001")
check("omni po payload status", p2["status"] == "Ordered")
check("omni po payload total", p2["total"] == 420000.00)

# ============================================================
# ERP → Core supplier payload
# ============================================================


class FakeSupplier:
    company_name = "Caterpillar Australia"
    payment_terms = "60 days"
    is_active = True


pc = map_erp_supplier_to_core(FakeSupplier())
check("core sup payload name", pc["Name"] == "Caterpillar Australia")
check("core sup payload payment", pc["PaymentTerm"] == "60 days")
check("core sup payload status", pc["Status"] == "Active")

FakeSupplier.is_active = False
check("core sup inactive", map_erp_supplier_to_core(FakeSupplier())["Status"] == "Inactive")
FakeSupplier.is_active = True

# ============================================================
# ERP → Omni supplier payload
# ============================================================

po2 = map_erp_supplier_to_omni(FakeSupplier())
check("omni sup payload name", po2["name"] == "Caterpillar Australia")
check("omni sup payload active", po2["isActive"] is True)

# ============================================================
# Purchase syncer helpers
# ============================================================

check(
    "core po id extract",
    Cin7PurchaseSyncer._extract_po_id({"PurchaseID": "po-001"}, "core") == "po-001",
)
check(
    "omni po id extract",
    Cin7PurchaseSyncer._extract_po_id({"id": 40001}, "omni") == "40001",
)
check(
    "core po ref extract",
    Cin7PurchaseSyncer._extract_po_ref({"PurchaseOrderNumber": "PO-001"}, "core") == "PO-001",
)
check(
    "omni po ref extract",
    Cin7PurchaseSyncer._extract_po_ref({"reference": "PO-001"}, "omni") == "PO-001",
)
check("core po missing id", Cin7PurchaseSyncer._extract_po_id({}, "core") is None)

# ============================================================
# AST verification for cin7_procurement.py endpoints
# ============================================================

_backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
with open(os.path.join(_backend_dir, "src", "api", "routes", "integrations", "cin7_procurement.py")) as fh:
    tree = ast.parse(fh.read())

route_funcs = [n.name for n in ast.walk(tree) if isinstance(n, ast.AsyncFunctionDef)]
for expected in [
    "sync_cin7_suppliers",
    "sync_cin7_supplier_single",
    "sync_cin7_purchases",
    "sync_cin7_purchase_single",
]:
    check(f"endpoint {expected}", expected in route_funcs)


print(f"Phase 4 Procurement sync tests: {passed} passed, {failed} failed")
sys.exit(1 if failed > 0 else 0)
