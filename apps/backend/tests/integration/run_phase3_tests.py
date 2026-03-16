"""Phase 3 test runner — runs outside pytest to avoid conftest.py deps."""

import sys
from datetime import UTC, datetime

from src.db.demo_models import OrderStatus, QuoteStatus
from src.integrations.cin7.customer_sync import (
    extract_core_customer_fields,
    extract_omni_contact_fields,
    generate_customer_number,
    map_erp_customer_to_core,
    map_erp_customer_to_omni,
)
from src.integrations.cin7.sales_sync import (
    CIN7_CORE_ORDER_STATUS,
    CIN7_OMNI_ORDER_STATUS,
    CIN7_OMNI_QUOTE_STATUS,
    Cin7SalesSyncer,
    generate_order_number,
    generate_quote_number,
    map_cin7_core_order_status,
    map_cin7_omni_order_status,
    map_cin7_omni_quote_status,
    map_erp_order_to_core,
    map_erp_order_to_omni,
    map_erp_quote_to_omni,
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


# --- Core Customer Field Mapping ---
CORE_CUST = {
    "ID": "cust-001-uuid",
    "Name": "Queensland Civil Construction",
    "Status": "Active",
    "Contacts": [
        {
            "Name": "Dave Mitchell",
            "Email": "dave@qldcivil.com.au",
            "Phone": "0412 345 678",
            "Default": True,
        }
    ],
    "Addresses": [
        {
            "Line1": "42 Industrial Drive",
            "City": "Brendale",
            "State": "QLD",
            "Postcode": "4500",
            "Country": "Australia",
        }
    ],
}

f = extract_core_customer_fields(CORE_CUST)
check("core company_name", f["company_name"] == "Queensland Civil Construction")
check("core contact_name", f["contact_name"] == "Dave Mitchell")
check("core email", f["email"] == "dave@qldcivil.com.au")
check("core phone", f["phone"] == "0412 345 678")
check("core address", f["address"] == "42 Industrial Drive")
check("core city", f["city"] == "Brendale")
check("core state", f["state"] == "QLD")
check("core postcode", f["postcode"] == "4500")
check("core active", f["is_active"] is True)

inactive = {**CORE_CUST, "Status": "Inactive"}
check("core inactive", extract_core_customer_fields(inactive)["is_active"] is False)

no_contacts = {**CORE_CUST, "Contacts": [], "Addresses": []}
f2 = extract_core_customer_fields(no_contacts)
check("core empty contacts", f2["contact_name"] == "")
check("core empty email", f2["email"] == "")
check("core empty address", f2["address"] is None)

# --- Omni Contact Field Mapping ---
OMNI_CONTACT = {
    "id": 20001,
    "company": "Queensland Civil Construction",
    "firstName": "Dave",
    "lastName": "Mitchell",
    "email": "dave@qldcivil.com.au",
    "phone": "0412 345 678",
    "city": "Brendale",
    "state": "QLD",
    "postcode": "4500",
    "isActive": True,
    "type": "Customer",
}

f3 = extract_omni_contact_fields(OMNI_CONTACT)
check("omni company", f3["company_name"] == "Queensland Civil Construction")
check("omni contact_name", f3["contact_name"] == "Dave Mitchell")
check("omni email", f3["email"] == "dave@qldcivil.com.au")
check("omni active", f3["is_active"] is True)
check(
    "omni first only",
    extract_omni_contact_fields({**OMNI_CONTACT, "lastName": ""})["contact_name"]
    == "Dave",
)
check(
    "omni no names",
    extract_omni_contact_fields({**OMNI_CONTACT, "firstName": "", "lastName": ""})[
        "contact_name"
    ]
    == "",
)

# --- Customer Number Generation ---
check(
    "cust num core",
    generate_customer_number("cust-001-uuid", "core") == "CIN7-C-cust-001",
)
check("cust num omni", generate_customer_number("20001", "omni") == "CIN7-O-20001")
check(
    "cust num long",
    generate_customer_number("abcdefghijklmnop", "core") == "CIN7-C-abcdefgh",
)
check("cust num short", generate_customer_number("123", "omni") == "CIN7-O-123")

# --- Core Order Status Mapping ---
check("draft", map_cin7_core_order_status("Draft") == OrderStatus.DRAFT)
check("authorised", map_cin7_core_order_status("Authorised") == OrderStatus.CONFIRMED)
check("ordered", map_cin7_core_order_status("Ordered") == OrderStatus.PROCESSING)
check("dispatched", map_cin7_core_order_status("Dispatched") == OrderStatus.SHIPPED)
check("completed", map_cin7_core_order_status("Completed") == OrderStatus.DELIVERED)
check("voided", map_cin7_core_order_status("Voided") == OrderStatus.CANCELLED)
check(
    "unknown core status",
    map_cin7_core_order_status("SomeNew") == OrderStatus.PENDING,
)
check("6 core statuses", len(CIN7_CORE_ORDER_STATUS) == 6)

# --- Omni Order Status Mapping ---
check("omni new", map_cin7_omni_order_status("New") == OrderStatus.PENDING)
check("omni dispatched", map_cin7_omni_order_status("Dispatched") == OrderStatus.SHIPPED)
check("omni completed", map_cin7_omni_order_status("Completed") == OrderStatus.DELIVERED)
check("omni cancelled", map_cin7_omni_order_status("Cancelled") == OrderStatus.CANCELLED)
check("unknown omni status", map_cin7_omni_order_status("Unknown") == OrderStatus.PENDING)
check("4 omni statuses", len(CIN7_OMNI_ORDER_STATUS) == 4)

# --- Omni Quote Status Mapping ---
check("quote pending", map_cin7_omni_quote_status("Pending") == QuoteStatus.SENT)
check("quote accepted", map_cin7_omni_quote_status("Accepted") == QuoteStatus.ACCEPTED)
check("quote declined", map_cin7_omni_quote_status("Declined") == QuoteStatus.REJECTED)
check("quote expired", map_cin7_omni_quote_status("Expired") == QuoteStatus.EXPIRED)
check("unknown quote status", map_cin7_omni_quote_status("Unknown") == QuoteStatus.DRAFT)
check("4 omni quote statuses", len(CIN7_OMNI_QUOTE_STATUS) == 4)

# --- Order/Quote Number Generation ---
check(
    "core order num",
    generate_order_number("SO-2025-001", "core") == "C7C-SO-2025-001",
)
check(
    "omni order num",
    generate_order_number("SO-2025-001", "omni") == "C7O-SO-2025-001",
)
check("quote num", generate_quote_number("Q-2025-001") == "C7Q-Q-2025-001")

# --- ERP to Core Sale Mapping ---


class FakeOrder:
    order_number = "ORD-2025-001"
    status = "confirmed"
    total = 285549.00
    order_date = datetime(2025, 12, 1, tzinfo=UTC)
    notes = "Urgent delivery"


p = map_erp_order_to_core(FakeOrder())
check("core sale order_number", p["SaleOrderNumber"] == "ORD-2025-001")
check("core sale status", p["Status"] == "Authorised")
check("core sale total", p["Total"] == 285549.00)
check("core sale date", p["OrderDate"] == "2025-12-01")


# --- ERP to Omni Sale Mapping ---
class FakeOrder2:
    order_number = "ORD-2025-001"
    status = "shipped"
    total = 1098.00
    order_date = datetime(2025, 12, 10, tzinfo=UTC)


p2 = map_erp_order_to_omni(FakeOrder2())
check("omni sale ref", p2["reference"] == "ORD-2025-001")
check("omni sale stage", p2["stage"] == "Dispatched")


# --- ERP to Omni Quote Mapping ---
class FakeQuote:
    quote_number = "Q-2025-001"
    status = "sent"
    total = 1647.00
    valid_until = datetime(2026, 1, 15, tzinfo=UTC)
    quote_date = datetime(2025, 12, 12, tzinfo=UTC)


p3 = map_erp_quote_to_omni(FakeQuote())
check("omni quote ref", p3["reference"] == "Q-2025-001")
check("omni quote stage", p3["stage"] == "Pending")
check("omni quote total", p3["total"] == 1647.00)


# --- ERP to Core Customer Mapping ---
class FakeCust:
    company_name = "Queensland Civil Construction"
    contact_name = "Dave Mitchell"
    email = "dave@qldcivil.com.au"
    phone = "0412 345 678"
    address = "42 Industrial Drive"
    city = "Brendale"
    state = "QLD"
    postcode = "4500"
    is_active = True


pc = map_erp_customer_to_core(FakeCust())
check("core cust Name", pc["Name"] == "Queensland Civil Construction")
check("core cust Contact", pc["Contacts"][0]["Name"] == "Dave Mitchell")
check("core cust Email", pc["Contacts"][0]["Email"] == "dave@qldcivil.com.au")
check("core cust Address", pc["Addresses"][0]["Line1"] == "42 Industrial Drive")
check("core cust Country", pc["Addresses"][0]["Country"] == "Australia")
check("core cust Status", pc["Status"] == "Active")

FakeCust.is_active = False
check("core cust inactive", map_erp_customer_to_core(FakeCust())["Status"] == "Inactive")
FakeCust.is_active = True

# --- ERP to Omni Contact Mapping ---
po = map_erp_customer_to_omni(FakeCust())
check("omni cust company", po["company"] == "Queensland Civil Construction")
check("omni cust firstName", po["firstName"] == "Dave")
check("omni cust lastName", po["lastName"] == "Mitchell")
check("omni cust country", po["country"] == "Australia")
check("omni cust type", po["type"] == "Customer")

# --- Sales Helpers ---
check(
    "core sale id",
    Cin7SalesSyncer._extract_order_id({"SaleID": "sale-001"}, "core") == "sale-001",
)
check(
    "omni sale id",
    Cin7SalesSyncer._extract_order_id({"id": 30001}, "omni") == "30001",
)
check(
    "core sale ref",
    Cin7SalesSyncer._extract_order_ref({"SaleOrderNumber": "SO-001"}, "core")
    == "SO-001",
)
check(
    "omni sale ref",
    Cin7SalesSyncer._extract_order_ref({"reference": "SO-001"}, "omni") == "SO-001",
)
check("core missing id", Cin7SalesSyncer._extract_order_id({}, "core") is None)
check("omni missing id", Cin7SalesSyncer._extract_order_id({}, "omni") is None)

# --- AST verification for cin7_crm.py endpoints ---
import ast

import os
_backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
with open(os.path.join(_backend_dir, "src", "api", "routes", "integrations", "cin7_crm.py")) as fh:
    tree = ast.parse(fh.read())

route_funcs = [n.name for n in ast.walk(tree) if isinstance(n, ast.AsyncFunctionDef)]
for expected in [
    "sync_cin7_customers",
    "sync_cin7_customer_single",
    "sync_cin7_orders",
    "sync_cin7_order_single",
    "sync_cin7_quotes",
    "sync_cin7_quote_single",
]:
    check(f"endpoint {expected}", expected in route_funcs)


print(f"Phase 3 CRM sync tests: {passed} passed, {failed} failed")
sys.exit(1 if failed > 0 else 0)
