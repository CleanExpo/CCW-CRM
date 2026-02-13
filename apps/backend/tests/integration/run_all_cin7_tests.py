"""Run all Cin7 tests (Phase 1+2+3) outside pytest to avoid conftest.py deps."""

import sys
import os

# Ensure correct PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from datetime import UTC, datetime

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
# PHASE 1: Settings + Client tests
# ============================================================

from src.config.cin7_settings import Cin7Settings, get_cin7_settings

s = Cin7Settings()

check("p1 settings mode", s.mode == "demo")
check("p1 settings core_account_id", s.core_account_id == "demo_account_id")
check("p1 settings core_app_key", s.core_application_key == "demo_application_key")
check("p1 settings omni_api_key", s.omni_api_key == "demo_omni_api_key")
check("p1 settings is_demo", s.is_demo_mode is True)
check("p1 settings core_base_url", "dearsystems.com" in s.core_base_url)
check("p1 settings omni_base_url", "cin7.com" in s.omni_base_url)

# Demo client tests
from src.integrations.cin7.demo_client import Cin7CoreDemoClient, Cin7OmniDemoClient

core_demo = Cin7CoreDemoClient()
omni_demo = Cin7OmniDemoClient()

import asyncio


async def run_demo_tests():
    p = 0
    f = 0

    # Core demo
    products = await core_demo.get_products()
    cond = "Products" in products and len(products["Products"]) > 0
    if cond:
        p += 1
    else:
        f += 1
        print("FAIL: p1 core demo products")

    customers = await core_demo.get_customers()
    cond = "CustomerList" in customers
    if cond:
        p += 1
    else:
        f += 1
        print("FAIL: p1 core demo customers")

    sales = await core_demo.get_sale_list()
    cond = "SaleList" in sales
    if cond:
        p += 1
    else:
        f += 1
        print("FAIL: p1 core demo sales")

    stock = await core_demo.get_product_availability()
    cond = isinstance(stock, dict)
    if cond:
        p += 1
    else:
        f += 1
        print("FAIL: p1 core demo stock")

    # Omni demo
    o_products = await omni_demo.get_products()
    cond = isinstance(o_products, list) and len(o_products) > 0
    if cond:
        p += 1
    else:
        f += 1
        print("FAIL: p1 omni demo products")

    o_contacts = await omni_demo.get_contacts()
    cond = isinstance(o_contacts, list)
    if cond:
        p += 1
    else:
        f += 1
        print("FAIL: p1 omni demo contacts")

    o_sales = await omni_demo.get_sales_orders()
    cond = isinstance(o_sales, list)
    if cond:
        p += 1
    else:
        f += 1
        print("FAIL: p1 omni demo sales")

    o_quotes = await omni_demo.get_quotes()
    cond = isinstance(o_quotes, list)
    if cond:
        p += 1
    else:
        f += 1
        print("FAIL: p1 omni demo quotes")

    o_stock = await omni_demo.get_stock()
    cond = isinstance(o_stock, list)
    if cond:
        p += 1
    else:
        f += 1
        print("FAIL: p1 omni demo stock")

    return p, f


dp, df = asyncio.run(run_demo_tests())
passed += dp
failed += df

# Unified client
from src.integrations.cin7.client import Cin7Client

check("p1 unified client has core", hasattr(Cin7Client, "__init__"))

print(f"  Phase 1: {passed} passed, {failed} failed")
p1_passed = passed
p1_failed = failed

# ============================================================
# PHASE 2: Product + Inventory sync tests
# ============================================================

from src.db.demo_models import ProductCategory
from src.db.inventory_models import StoreLocation
from src.integrations.cin7.product_sync import (
    CIN7_TO_ERP_CATEGORY,
    ERP_TO_CIN7_CATEGORY,
    Cin7ProductSyncer,
    map_cin7_category,
    map_erp_category,
)
from src.integrations.cin7.inventory_sync import (
    CIN7_TO_ERP_LOCATION,
    Cin7InventorySyncer,
    map_cin7_location,
    map_erp_location,
)

# Category mapping
check("p2 heavy_machinery", map_cin7_category("Heavy Machinery") == ProductCategory.HEAVY_MACHINERY)
check("p2 hand_tools", map_cin7_category("Hand Tools") == ProductCategory.HAND_TOOLS)
check("p2 power_tools", map_cin7_category("Power Tools") == ProductCategory.POWER_TOOLS)
check("p2 safety_equipment", map_cin7_category("Safety Equipment") == ProductCategory.SAFETY_EQUIPMENT)
check("p2 building_materials", map_cin7_category("Building Materials") == ProductCategory.BUILDING_MATERIALS)
check("p2 electrical", map_cin7_category("Electrical") == ProductCategory.ELECTRICAL)
check("p2 plumbing", map_cin7_category("Plumbing") == ProductCategory.PLUMBING)
check("p2 accessories", map_cin7_category("Accessories") == ProductCategory.ACCESSORIES)
check("p2 unknown category", map_cin7_category("Some New") == ProductCategory.ACCESSORIES)

# Reverse mapping
for cin7_name, erp_cat in CIN7_TO_ERP_CATEGORY.items():
    check(f"p2 reverse {cin7_name}", ERP_TO_CIN7_CATEGORY[erp_cat] == cin7_name)

check("p2 erp_cat enum", map_erp_category(ProductCategory.HEAVY_MACHINERY) == "Heavy Machinery")
check("p2 erp_cat string", map_erp_category("POWER_TOOLS") == "Power Tools")
check("p2 erp_cat invalid", map_erp_category("invalid_value") == "Accessories")

# Core product field extraction
CORE_PRODUCT = {
    "ID": "a1b2c3d4",
    "SKU": "HM-EXC-001",
    "Name": "CAT 320 Excavator",
    "Category": "Heavy Machinery",
    "PriceTier1": 285000.00,
    "AverageCost": 210000.00,
    "DefaultLocation": "Brisbane Warehouse",
    "Status": "Active",
}
check("p2 core sku", Cin7ProductSyncer._extract_sku(CORE_PRODUCT, "core") == "HM-EXC-001")
check("p2 core sku missing", Cin7ProductSyncer._extract_sku({}, "core") is None)

# Omni product field extraction
OMNI_PRODUCT = {
    "id": 10001,
    "styleCode": "HM-EXC-001",
    "description": "CAT 320 Excavator",
    "category": "Heavy Machinery",
    "retailPrice": 285000.00,
    "isActive": True,
}
check("p2 omni sku", Cin7ProductSyncer._extract_sku(OMNI_PRODUCT, "omni") == "HM-EXC-001")
check("p2 omni sku missing", Cin7ProductSyncer._extract_sku({}, "omni") is None)

# Location mapping
check("p2 brisbane", map_cin7_location("Brisbane Warehouse") == StoreLocation.BRISBANE)
check("p2 sydney", map_cin7_location("Sydney Branch") == StoreLocation.SYDNEY)
check("p2 melbourne", map_cin7_location("Melbourne Depot") == StoreLocation.MELBOURNE)
check("p2 unknown loc", map_cin7_location("Perth Office") is None)
check("p2 reverse brisbane", map_erp_location(StoreLocation.BRISBANE) == "Brisbane Warehouse")
check("p2 reverse sydney", map_erp_location(StoreLocation.SYDNEY) == "Sydney Branch")
check("p2 reverse melbourne", map_erp_location(StoreLocation.MELBOURNE) == "Melbourne Depot")
check("p2 3 locations", len(CIN7_TO_ERP_LOCATION) == 3)

# Stock extraction
item_core = {"OnHand": 45.0, "Allocated": 8.0, "Available": 37.0, "Location": "Brisbane Warehouse"}
check("p2 core stock", Cin7InventorySyncer._extract_stock(item_core, "core") == 45)
check("p2 core reserved", Cin7InventorySyncer._extract_reserved(item_core, "core") == 8)
check("p2 core location", Cin7InventorySyncer._extract_location(item_core, "core") == "Brisbane Warehouse")

item_omni = {"stockOnHand": 45, "stockAvailable": 37, "branchName": "Sydney Branch"}
check("p2 omni stock", Cin7InventorySyncer._extract_stock(item_omni, "omni") == 45)
check("p2 omni reserved", Cin7InventorySyncer._extract_reserved(item_omni, "omni") == 8)
check("p2 omni location", Cin7InventorySyncer._extract_location(item_omni, "omni") == "Sydney Branch")

check("p2 missing stock", Cin7InventorySyncer._extract_stock({}, "core") == 0)
check("p2 missing reserved", Cin7InventorySyncer._extract_reserved({}, "core") == 0)

# ERP to Cin7 mapping


class FakeProduct:
    sku = "PT-DRL-002"
    name = "Makita 18V Hammer Drill Kit"
    category = "POWER_TOOLS"
    price = 549.00
    cost = 320.00
    warehouse_location = "Brisbane Warehouse"
    is_active = True


p = Cin7ProductSyncer._map_erp_to_cin7_core(FakeProduct())
check("p2 core payload sku", p["SKU"] == "PT-DRL-002")
check("p2 core payload name", p["Name"] == "Makita 18V Hammer Drill Kit")
check("p2 core payload cat", p["Category"] == "Power Tools")
check("p2 core payload price", p["PriceTier1"] == 549.00)
check("p2 core payload cost", p["AverageCost"] == 320.00)
check("p2 core payload status", p["Status"] == "Active")

po = Cin7ProductSyncer._map_erp_to_cin7_omni(FakeProduct())
check("p2 omni payload sku", po["styleCode"] == "PT-DRL-002")
check("p2 omni payload name", po["description"] == "Makita 18V Hammer Drill Kit")
check("p2 omni payload cat", po["category"] == "Power Tools")
check("p2 omni payload price", po["retailPrice"] == 549.00)
check("p2 omni payload active", po["isActive"] is True)

FakeProduct.is_active = False
check("p2 inactive", Cin7ProductSyncer._map_erp_to_cin7_core(FakeProduct())["Status"] == "Inactive")
FakeProduct.is_active = True

p2_passed = passed - p1_passed
p2_failed = failed - p1_failed
print(f"  Phase 2: {p2_passed} passed, {p2_failed} failed")

# ============================================================
# PHASE 3: Customer + Sales + Quotes sync tests
# ============================================================

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

# Core customer field mapping
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
check("p3 core company_name", f["company_name"] == "Queensland Civil Construction")
check("p3 core contact_name", f["contact_name"] == "Dave Mitchell")
check("p3 core email", f["email"] == "dave@qldcivil.com.au")
check("p3 core phone", f["phone"] == "0412 345 678")
check("p3 core address", f["address"] == "42 Industrial Drive")
check("p3 core city", f["city"] == "Brendale")
check("p3 core state", f["state"] == "QLD")
check("p3 core postcode", f["postcode"] == "4500")
check("p3 core active", f["is_active"] is True)

inactive = {**CORE_CUST, "Status": "Inactive"}
check("p3 core inactive", extract_core_customer_fields(inactive)["is_active"] is False)

no_contacts = {**CORE_CUST, "Contacts": [], "Addresses": []}
f2 = extract_core_customer_fields(no_contacts)
check("p3 core empty contacts", f2["contact_name"] == "")
check("p3 core empty email", f2["email"] == "")
check("p3 core empty address", f2["address"] is None)

# Omni contact field mapping
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
check("p3 omni company", f3["company_name"] == "Queensland Civil Construction")
check("p3 omni contact_name", f3["contact_name"] == "Dave Mitchell")
check("p3 omni email", f3["email"] == "dave@qldcivil.com.au")
check("p3 omni active", f3["is_active"] is True)
check(
    "p3 omni first only",
    extract_omni_contact_fields({**OMNI_CONTACT, "lastName": ""})["contact_name"] == "Dave",
)
check(
    "p3 omni no names",
    extract_omni_contact_fields({**OMNI_CONTACT, "firstName": "", "lastName": ""})["contact_name"]
    == "",
)

# Customer number generation
check("p3 cust num core", generate_customer_number("cust-001-uuid", "core") == "CIN7-C-cust-001")
check("p3 cust num omni", generate_customer_number("20001", "omni") == "CIN7-O-20001")
check(
    "p3 cust num long",
    generate_customer_number("abcdefghijklmnop", "core") == "CIN7-C-abcdefgh",
)
check("p3 cust num short", generate_customer_number("123", "omni") == "CIN7-O-123")

# Core order status mapping
check("p3 draft", map_cin7_core_order_status("Draft") == OrderStatus.DRAFT)
check("p3 authorised", map_cin7_core_order_status("Authorised") == OrderStatus.CONFIRMED)
check("p3 ordered", map_cin7_core_order_status("Ordered") == OrderStatus.PROCESSING)
check("p3 dispatched", map_cin7_core_order_status("Dispatched") == OrderStatus.SHIPPED)
check("p3 completed", map_cin7_core_order_status("Completed") == OrderStatus.DELIVERED)
check("p3 voided", map_cin7_core_order_status("Voided") == OrderStatus.CANCELLED)
check("p3 unknown core status", map_cin7_core_order_status("SomeNew") == OrderStatus.PENDING)
check("p3 6 core statuses", len(CIN7_CORE_ORDER_STATUS) == 6)

# Omni order status mapping
check("p3 omni new", map_cin7_omni_order_status("New") == OrderStatus.PENDING)
check("p3 omni dispatched", map_cin7_omni_order_status("Dispatched") == OrderStatus.SHIPPED)
check("p3 omni completed", map_cin7_omni_order_status("Completed") == OrderStatus.DELIVERED)
check("p3 omni cancelled", map_cin7_omni_order_status("Cancelled") == OrderStatus.CANCELLED)
check("p3 unknown omni status", map_cin7_omni_order_status("Unknown") == OrderStatus.PENDING)
check("p3 4 omni statuses", len(CIN7_OMNI_ORDER_STATUS) == 4)

# Omni quote status mapping
check("p3 quote pending", map_cin7_omni_quote_status("Pending") == QuoteStatus.SENT)
check("p3 quote accepted", map_cin7_omni_quote_status("Accepted") == QuoteStatus.ACCEPTED)
check("p3 quote declined", map_cin7_omni_quote_status("Declined") == QuoteStatus.REJECTED)
check("p3 quote expired", map_cin7_omni_quote_status("Expired") == QuoteStatus.EXPIRED)
check("p3 unknown quote status", map_cin7_omni_quote_status("Unknown") == QuoteStatus.DRAFT)
check("p3 4 omni quote statuses", len(CIN7_OMNI_QUOTE_STATUS) == 4)

# Order/Quote number generation
check("p3 core order num", generate_order_number("SO-2025-001", "core") == "C7C-SO-2025-001")
check("p3 omni order num", generate_order_number("SO-2025-001", "omni") == "C7O-SO-2025-001")
check("p3 quote num", generate_quote_number("Q-2025-001") == "C7Q-Q-2025-001")


# ERP to Core Sale mapping
class FakeOrder:
    order_number = "ORD-2025-001"
    status = "confirmed"
    total = 285549.00
    order_date = datetime(2025, 12, 1, tzinfo=UTC)
    notes = "Urgent delivery"


pm = map_erp_order_to_core(FakeOrder())
check("p3 core sale order_number", pm["SaleOrderNumber"] == "ORD-2025-001")
check("p3 core sale status", pm["Status"] == "Authorised")
check("p3 core sale total", pm["Total"] == 285549.00)
check("p3 core sale date", pm["OrderDate"] == "2025-12-01")


# ERP to Omni Sale mapping
class FakeOrder2:
    order_number = "ORD-2025-001"
    status = "shipped"
    total = 1098.00
    order_date = datetime(2025, 12, 10, tzinfo=UTC)


pm2 = map_erp_order_to_omni(FakeOrder2())
check("p3 omni sale ref", pm2["reference"] == "ORD-2025-001")
check("p3 omni sale stage", pm2["stage"] == "Dispatched")


# ERP to Omni Quote mapping
class FakeQuote:
    quote_number = "Q-2025-001"
    status = "sent"
    total = 1647.00
    valid_until = datetime(2026, 1, 15, tzinfo=UTC)
    quote_date = datetime(2025, 12, 12, tzinfo=UTC)


pm3 = map_erp_quote_to_omni(FakeQuote())
check("p3 omni quote ref", pm3["reference"] == "Q-2025-001")
check("p3 omni quote stage", pm3["stage"] == "Pending")
check("p3 omni quote total", pm3["total"] == 1647.00)


# ERP to Core Customer mapping
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
check("p3 core cust Name", pc["Name"] == "Queensland Civil Construction")
check("p3 core cust Contact", pc["Contacts"][0]["Name"] == "Dave Mitchell")
check("p3 core cust Email", pc["Contacts"][0]["Email"] == "dave@qldcivil.com.au")
check("p3 core cust Address", pc["Addresses"][0]["Line1"] == "42 Industrial Drive")
check("p3 core cust Country", pc["Addresses"][0]["Country"] == "Australia")
check("p3 core cust Status", pc["Status"] == "Active")

FakeCust.is_active = False
check("p3 core cust inactive", map_erp_customer_to_core(FakeCust())["Status"] == "Inactive")
FakeCust.is_active = True

# ERP to Omni Contact mapping
poc = map_erp_customer_to_omni(FakeCust())
check("p3 omni cust company", poc["company"] == "Queensland Civil Construction")
check("p3 omni cust firstName", poc["firstName"] == "Dave")
check("p3 omni cust lastName", poc["lastName"] == "Mitchell")
check("p3 omni cust country", poc["country"] == "Australia")
check("p3 omni cust type", poc["type"] == "Customer")

# Sales helpers
check(
    "p3 core sale id",
    Cin7SalesSyncer._extract_order_id({"SaleID": "sale-001"}, "core") == "sale-001",
)
check(
    "p3 omni sale id",
    Cin7SalesSyncer._extract_order_id({"id": 30001}, "omni") == "30001",
)
check(
    "p3 core sale ref",
    Cin7SalesSyncer._extract_order_ref({"SaleOrderNumber": "SO-001"}, "core") == "SO-001",
)
check(
    "p3 omni sale ref",
    Cin7SalesSyncer._extract_order_ref({"reference": "SO-001"}, "omni") == "SO-001",
)
check("p3 core missing id", Cin7SalesSyncer._extract_order_id({}, "core") is None)
check("p3 omni missing id", Cin7SalesSyncer._extract_order_id({}, "omni") is None)

# AST verification for cin7_crm.py endpoints
import ast

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
    check(f"p3 endpoint {expected}", expected in route_funcs)

p3_passed = passed - p1_passed - p2_passed
p3_failed = failed - p1_failed - p2_failed
print(f"  Phase 3: {p3_passed} passed, {p3_failed} failed")

# ============================================================
# PHASE 4: Procurement (Suppliers + Purchase Orders)
# ============================================================

from src.integrations.cin7.supplier_sync import (
    extract_core_supplier_fields,
    generate_supplier_code,
    map_erp_supplier_to_core,
    map_erp_supplier_to_omni,
)
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

# Supplier field extraction
CORE_SUP = {
    "ID": "sup-001-uuid",
    "Name": "Caterpillar Australia",
    "Currency": "AUD",
    "PaymentTerm": "60 days",
    "TaxRule": "GST on Purchases",
    "Status": "Active",
}
sf = extract_core_supplier_fields(CORE_SUP)
check("p4 sup company", sf["company_name"] == "Caterpillar Australia")
check("p4 sup payment", sf["payment_terms"] == "60 days")
check("p4 sup active", sf["is_active"] is True)
check("p4 sup inactive", extract_core_supplier_fields({**CORE_SUP, "Status": "Inactive"})["is_active"] is False)

# Supplier code
check("p4 sup code", generate_supplier_code("sup-001-uuid", "core") == "CIN7-S-sup-001-")
check("p4 sup code long", generate_supplier_code("abcdefghijklmnop", "omni") == "CIN7-S-abcdefgh")
check("p4 sup code short", generate_supplier_code("123", "core") == "CIN7-S-123")

# Core PO status
check("p4 core po draft", map_cin7_core_po_status("Draft") == "draft")
check("p4 core po ordered", map_cin7_core_po_status("Ordered") == "ordered")
check("p4 core po received", map_cin7_core_po_status("Received") == "received")
check("p4 core po voided", map_cin7_core_po_status("Voided") == "cancelled")
check("p4 core po unknown", map_cin7_core_po_status("SomeNew") == "draft")
check("p4 core po count", len(CIN7_CORE_PO_STATUS) == 4)

# Omni PO status
check("p4 omni po new", map_cin7_omni_po_status("New") == "draft")
check("p4 omni po ordered", map_cin7_omni_po_status("Ordered") == "ordered")
check("p4 omni po received", map_cin7_omni_po_status("Received") == "received")
check("p4 omni po cancelled", map_cin7_omni_po_status("Cancelled") == "cancelled")
check("p4 omni po unknown", map_cin7_omni_po_status("Unknown") == "draft")
check("p4 omni po count", len(CIN7_OMNI_PO_STATUS) == 4)

# ERP → Core reverse
check("p4 erp→core draft", ERP_TO_CIN7_CORE_PO_STATUS["draft"] == "Draft")
check("p4 erp→core pending", ERP_TO_CIN7_CORE_PO_STATUS["pending_approval"] == "Draft")
check("p4 erp→core approved", ERP_TO_CIN7_CORE_PO_STATUS["approved"] == "Draft")
check("p4 erp→core ordered", ERP_TO_CIN7_CORE_PO_STATUS["ordered"] == "Ordered")
check("p4 erp→core transit", ERP_TO_CIN7_CORE_PO_STATUS["in_transit"] == "Ordered")
check("p4 erp→core received", ERP_TO_CIN7_CORE_PO_STATUS["received"] == "Received")
check("p4 erp→core cancelled", ERP_TO_CIN7_CORE_PO_STATUS["cancelled"] == "Voided")

# ERP → Omni reverse
check("p4 erp→omni draft", ERP_TO_CIN7_OMNI_PO_STATUS["draft"] == "New")
check("p4 erp→omni pending", ERP_TO_CIN7_OMNI_PO_STATUS["pending_approval"] == "New")
check("p4 erp→omni approved", ERP_TO_CIN7_OMNI_PO_STATUS["approved"] == "New")
check("p4 erp→omni ordered", ERP_TO_CIN7_OMNI_PO_STATUS["ordered"] == "Ordered")
check("p4 erp→omni transit", ERP_TO_CIN7_OMNI_PO_STATUS["in_transit"] == "Ordered")
check("p4 erp→omni received", ERP_TO_CIN7_OMNI_PO_STATUS["received"] == "Received")
check("p4 erp→omni cancelled", ERP_TO_CIN7_OMNI_PO_STATUS["cancelled"] == "Cancelled")

# PO number generation
check("p4 po num core", generate_po_number("PO-2025-001", "core") == "C7C-PO-2025-001")
check("p4 po num omni", generate_po_number("PO-2025-001", "omni") == "C7O-PO-2025-001")

# ERP → Core PO payload


class FakePO4:
    po_number = "PO-2025-001"
    status = "ordered"
    total = 420000.00
    order_date = datetime(2025, 11, 15, tzinfo=UTC)


pp = map_erp_po_to_core(FakePO4())
check("p4 core po num", pp["PurchaseOrderNumber"] == "PO-2025-001")
check("p4 core po status", pp["Status"] == "Ordered")
check("p4 core po total", pp["Total"] == 420000.00)
check("p4 core po date", pp["OrderDate"] == "2025-11-15")

pp2 = map_erp_po_to_omni(FakePO4())
check("p4 omni po ref", pp2["reference"] == "PO-2025-001")
check("p4 omni po status", pp2["status"] == "Ordered")
check("p4 omni po total", pp2["total"] == 420000.00)

# ERP → Core supplier payload


class FakeSup4:
    company_name = "Caterpillar Australia"
    payment_terms = "60 days"
    is_active = True


spc = map_erp_supplier_to_core(FakeSup4())
check("p4 core sup name", spc["Name"] == "Caterpillar Australia")
check("p4 core sup payment", spc["PaymentTerm"] == "60 days")
check("p4 core sup status", spc["Status"] == "Active")

FakeSup4.is_active = False
check("p4 core sup inactive", map_erp_supplier_to_core(FakeSup4())["Status"] == "Inactive")
FakeSup4.is_active = True

spo = map_erp_supplier_to_omni(FakeSup4())
check("p4 omni sup name", spo["name"] == "Caterpillar Australia")
check("p4 omni sup active", spo["isActive"] is True)

# Purchase syncer helpers
check("p4 core po id", Cin7PurchaseSyncer._extract_po_id({"PurchaseID": "po-001"}, "core") == "po-001")
check("p4 omni po id", Cin7PurchaseSyncer._extract_po_id({"id": 40001}, "omni") == "40001")
check("p4 core po ref", Cin7PurchaseSyncer._extract_po_ref({"PurchaseOrderNumber": "PO-001"}, "core") == "PO-001")
check("p4 omni po ref", Cin7PurchaseSyncer._extract_po_ref({"reference": "PO-001"}, "omni") == "PO-001")
check("p4 core po missing", Cin7PurchaseSyncer._extract_po_id({}, "core") is None)

# AST verification for cin7_procurement.py endpoints
with open(os.path.join(_backend_dir, "src", "api", "routes", "integrations", "cin7_procurement.py")) as fh:
    tree4 = ast.parse(fh.read())

route_funcs4 = [n.name for n in ast.walk(tree4) if isinstance(n, ast.AsyncFunctionDef)]
for expected in [
    "sync_cin7_suppliers",
    "sync_cin7_supplier_single",
    "sync_cin7_purchases",
    "sync_cin7_purchase_single",
]:
    check(f"p4 endpoint {expected}", expected in route_funcs4)

p4_passed = passed - p1_passed - p2_passed - p3_passed
p4_failed = failed - p1_failed - p2_failed - p3_failed
print(f"  Phase 4: {p4_passed} passed, {p4_failed} failed")

# ============================================================
# PHASE 5: Webhooks + Real-time Events
# ============================================================

import hashlib
import hmac

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

# Import cin7_webhooks directly to avoid integrations/__init__.py chain
import importlib.util as _ilu

_wh_spec = _ilu.spec_from_file_location(
    "cin7_webhooks",
    os.path.join(_backend_dir, "src", "api", "routes", "integrations", "cin7_webhooks.py"),
)
_wh_mod = _ilu.module_from_spec(_wh_spec)
_wh_spec.loader.exec_module(_wh_mod)

p5_verify = _wh_mod.verify_cin7_signature
p5_route = _wh_mod.route_webhook_event
p5_event_map = _wh_mod.CIN7_WEBHOOK_EVENT_MAP

# format_modified_since
p5_dt = datetime(2025, 11, 15, 8, 30, 45, tzinfo=UTC)
check("p5 core format", format_modified_since(p5_dt) == "2025-11-15T08:30:45")
check("p5 core format naive", format_modified_since(datetime(2025, 6, 1, 12, 0, 0)) == "2025-06-01T12:00:00")
check("p5 omni format", format_modified_since_omni(p5_dt) == "2025-11-15T08:30:45Z")
check("p5 omni format naive", format_modified_since_omni(datetime(2025, 6, 1, 12, 0, 0)) == "2025-06-01T12:00:00Z")

# detect_product_changes
p5_prods = detect_product_changes([{"ID": "prod-001", "Name": "Excavator"}], "core")
check("p5 detect prod count", len(p5_prods) == 1)
check("p5 detect prod id", p5_prods[0]["entity_id"] == "prod-001")
check("p5 detect prod name", p5_prods[0]["name"] == "Excavator")
check("p5 detect prod empty", len(detect_product_changes([], "core")) == 0)

p5_prods_o = detect_product_changes([{"id": 10001, "description": "Drill"}], "omni")
check("p5 detect prod omni id", p5_prods_o[0]["entity_id"] == "10001")

# detect_customer_changes
p5_custs = detect_customer_changes([{"ID": "cust-001", "Name": "QLD Civil"}], "core")
check("p5 detect cust count", len(p5_custs) == 1)
check("p5 detect cust id", p5_custs[0]["entity_id"] == "cust-001")
check("p5 detect cust empty", len(detect_customer_changes([], "core")) == 0)

# detect_sales_changes
p5_sales = detect_sales_changes([{"SaleID": "s-001", "OrderNumber": "SO-001", "Status": "Ordered"}], "core")
check("p5 detect sales count", len(p5_sales) == 1)
check("p5 detect sales ref", p5_sales[0]["reference"] == "SO-001")
check("p5 detect sales empty", len(detect_sales_changes([], "core")) == 0)

# detect_inventory_changes
p5_inv = detect_inventory_changes([{"ProductID": "p-001", "Location": "Brisbane", "Available": 5}], "core")
check("p5 detect inv count", len(p5_inv) == 1)
check("p5 detect inv loc", p5_inv[0]["location"] == "Brisbane")
check("p5 detect inv empty", len(detect_inventory_changes([], "core")) == 0)

# Event constants
check("p5 event count", len(ALL_CIN7_EVENTS) == 7)
check("p5 sse channel", CIN7_SSE_CHANNEL == "cin7-sync")

# build_product_event
p5_pe = build_product_event({"entity_id": "p1", "name": "Test"}, "core", "created")
check("p5 build pe type", p5_pe["event_type"] == CIN7_EVENT_PRODUCT_CHANGED)
check("p5 build pe action", p5_pe["action"] == "created")
check("p5 build pe has ts", "timestamp" in p5_pe)

# build_customer_event
p5_ce = build_customer_event({"entity_id": "c1", "name": "QLD"}, "omni")
check("p5 build ce type", p5_ce["event_type"] == CIN7_EVENT_CUSTOMER_CHANGED)

# build_sales_event
p5_se = build_sales_event({"entity_id": "s1", "reference": "SO", "status": "OK"}, "core")
check("p5 build se type", p5_se["event_type"] == CIN7_EVENT_SALES_CHANGED)

# build_inventory_event
p5_ie = build_inventory_event({"entity_id": "i1", "location": "SYD", "available": 10}, "core")
check("p5 build ie type", p5_ie["event_type"] == CIN7_EVENT_INVENTORY_CHANGED)

# build_sync_result_event
p5_sre = build_sync_result_event("products", "completed", 42)
check("p5 sync result ok", p5_sre["event_type"] == CIN7_EVENT_SYNC_COMPLETED)
check("p5 sync result records", p5_sre["records_processed"] == 42)

p5_srf = build_sync_result_event("customers", "failed", 0, "timeout")
check("p5 sync result fail", p5_srf["event_type"] == CIN7_EVENT_SYNC_FAILED)
check("p5 sync result error", p5_srf["error"] == "timeout")

# build_poll_summary_event
p5_pse = build_poll_summary_event(["products"], 5, 1200)
check("p5 poll summary type", p5_pse["event_type"] == CIN7_EVENT_POLL_COMPLETED)
check("p5 poll summary changes", p5_pse["changes_detected"] == 5)

# verify_cin7_signature
p5_secret = "test_key"
p5_payload = b'{"event_type":"product.updated"}'
p5_valid_sig = hmac.new(p5_secret.encode("utf-8"), p5_payload, hashlib.sha256).hexdigest()
check("p5 sig valid", p5_verify(p5_payload, p5_valid_sig, p5_secret) is True)
check("p5 sig invalid", p5_verify(p5_payload, "bad", p5_secret) is False)
check("p5 sig empty", p5_verify(p5_payload, "", p5_secret) is False)

# route_webhook_event
check("p5 route product", p5_route("product.updated") == CIN7_EVENT_PRODUCT_CHANGED)
check("p5 route order", p5_route("order.created") == CIN7_EVENT_SALES_CHANGED)
check("p5 route unknown", p5_route("unknown") is None)
check("p5 event map count", len(p5_event_map) == 8)

# AST verification — cin7_webhooks.py
with open(os.path.join(_backend_dir, "src", "api", "routes", "integrations", "cin7_webhooks.py")) as fh:
    tree_wh5 = ast.parse(fh.read())

wh5_funcs = [n.name for n in ast.walk(tree_wh5) if isinstance(n, ast.AsyncFunctionDef)]
for expected in ["receive_cin7_webhook", "get_cin7_webhook_status", "test_cin7_webhook"]:
    check(f"p5 wh endpoint {expected}", expected in wh5_funcs)

# AST verification — cin7_stream.py
with open(os.path.join(_backend_dir, "src", "api", "routes", "integrations", "cin7_stream.py")) as fh:
    tree_st5 = ast.parse(fh.read())

st5_funcs = [n.name for n in ast.walk(tree_st5) if isinstance(n, ast.AsyncFunctionDef)]
for expected in [
    "cin7_sync_stream",
    "get_cin7_stream_stats",
    "publish_test_cin7_event",
    "trigger_cin7_poll",
    "get_cin7_poll_status",
]:
    check(f"p5 stream endpoint {expected}", expected in st5_funcs)

p5_passed = passed - p1_passed - p2_passed - p3_passed - p4_passed
p5_failed = failed - p1_failed - p2_failed - p3_failed - p4_failed
print(f"  Phase 5: {p5_passed} passed, {p5_failed} failed")

# ============================================================
# PHASE 6: AI Agents (forecasting + anomaly detection)
# ============================================================

import importlib.util as _ilu6
import types as _types6

# Mock BaseAgent to avoid asyncpg import chain
class _MockBaseAgent6:
    def __init__(self, name=None, auto_register=True, **kwargs):
        self.agent_id = "test-agent-id"
        self.name = name or self.__class__.__name__
        self.tools = []
        self.capabilities = []
    async def execute(self, task, context=None):
        return {}
    async def stream(self, task, context=None):
        yield ""
    def _log_execution_start(self, *a, **kw):
        pass
    def _log_execution_complete(self, *a, **kw):
        pass
    def _schedule_registration(self):
        pass

_mock_base_mod6 = _types6.ModuleType("src.ai.base_agent")
_mock_base_mod6.BaseAgent = _MockBaseAgent6
sys.modules["src.ai.base_agent"] = _mock_base_mod6

# Mock structlog and sqlalchemy for agent imports
if "structlog" not in sys.modules:
    _mock_structlog6 = _types6.ModuleType("structlog")
    _mock_structlog6.get_logger = lambda *a, **kw: type("L", (), {"info": lambda *a, **kw: None, "error": lambda *a, **kw: None, "warning": lambda *a, **kw: None})()
    sys.modules["structlog"] = _mock_structlog6

# Load forecasting agent
_fc_spec = _ilu6.spec_from_file_location(
    "cin7_forecasting_agent",
    os.path.join(_backend_dir, "src", "ai", "agents", "specialized", "cin7_forecasting_agent.py"),
)
_fc_mod = _ilu6.module_from_spec(_fc_spec)
_fc_spec.loader.exec_module(_fc_mod)

# Load anomaly agent
_an_spec = _ilu6.spec_from_file_location(
    "cin7_anomaly_agent",
    os.path.join(_backend_dir, "src", "ai", "agents", "specialized", "cin7_anomaly_agent.py"),
)
_an_mod = _ilu6.module_from_spec(_an_spec)
_an_spec.loader.exec_module(_an_mod)

# Forecasting pure functions
from datetime import timedelta

calc_velocity = _fc_mod.calculate_sync_velocity
estimate_reorder = _fc_mod.estimate_cin7_reorder_point
detect_season = _fc_mod.detect_sync_seasonality

# Velocity
v1 = calc_velocity([
    {"synced_at": datetime(2025, 1, 1, tzinfo=UTC), "records_processed": 10, "status": "completed"},
    {"synced_at": datetime(2025, 1, 2, tzinfo=UTC), "records_processed": 20, "status": "completed"},
    {"synced_at": datetime(2025, 1, 3, tzinfo=UTC), "records_processed": 15, "status": "completed"},
])
check("p6 velocity syncs_per_day", v1["syncs_per_day"] > 0)
check("p6 velocity avg_changes", v1["avg_changes"] > 0)
check("p6 velocity trend", v1["trend"] in ("increasing", "decreasing", "stable"))

v_empty = calc_velocity([])
check("p6 velocity empty", v_empty["syncs_per_day"] == 0)

# Reorder point
check("p6 reorder basic", estimate_reorder(5.0, 7, 1.5) > 0)
check("p6 reorder zero", estimate_reorder(0.0, 7, 1.5) == 0)

# Seasonality
s1 = detect_season({"Jan": 10, "Feb": 5, "Mar": 8, "Apr": 3, "May": 15, "Jun": 20, "Jul": 12, "Aug": 8, "Sep": 6, "Oct": 4, "Nov": 18, "Dec": 22})
check("p6 season detected", isinstance(s1["pattern_detected"], bool))
check("p6 season peaks", isinstance(s1["peak_months"], list))

s_empty = detect_season({})
check("p6 season empty", s_empty["pattern_detected"] is False)

# Anomaly pure functions
detect_freq = _an_mod.detect_sync_frequency_anomaly
detect_drift = _an_mod.detect_price_drift
detect_mismatch = _an_mod.detect_stock_mismatch
calc_health = _an_mod.calculate_sync_health_score
detect_gaps = _an_mod.detect_mapping_gaps

# Sync frequency
base = datetime(2025, 1, 1, tzinfo=UTC)
normal_times = [base + timedelta(seconds=300 * i) for i in range(10)]
check("p6 freq normal", detect_freq(normal_times)["is_anomaly"] is False)

gap_times = [base, base + timedelta(seconds=300), base + timedelta(seconds=3000)]
check("p6 freq gap", detect_freq(gap_times)["is_anomaly"] is True)

spike_times = [base, base + timedelta(seconds=10), base + timedelta(seconds=300)]
check("p6 freq spike", detect_freq(spike_times)["is_anomaly"] is True)

check("p6 freq insufficient", detect_freq([base])["is_anomaly"] is False)

# Price drift
check("p6 drift within", detect_drift(100.0, 103.0)["is_anomaly"] is False)
check("p6 drift over", detect_drift(100.0, 120.0)["is_anomaly"] is True)
check("p6 drift zero", detect_drift(0.0, 0.0)["is_anomaly"] is False)
check("p6 drift erp_zero", detect_drift(0.0, 50.0)["severity"] == "high")

# Stock mismatch
check("p6 stock match", detect_mismatch(100, 102)["is_anomaly"] is False)
check("p6 stock mismatch", detect_mismatch(100, 150)["is_anomaly"] is True)
check("p6 stock critical", detect_mismatch(100, 200)["severity"] == "critical")

# Health score
h_good = calc_health(95, 5, 500)
check("p6 health good score", h_good["score"] >= 80)
check("p6 health good grade", h_good["grade"] in ("A", "B"))

h_bad = calc_health(10, 90, 15000)
check("p6 health bad score", h_bad["score"] < 50)
check("p6 health bad grade", h_bad["grade"] in ("D", "F"))

# Mapping gaps
check("p6 gaps full", detect_gaps(100, 100)["is_anomaly"] is False)
check("p6 gaps partial", detect_gaps(100, 50)["is_anomaly"] is True)
check("p6 gaps empty", detect_gaps(0, 0)["is_anomaly"] is False)

# AST verification
with open(os.path.join(_backend_dir, "src", "api", "routes", "ai", "cin7_forecast.py")) as fh:
    tree_fc6 = ast.parse(fh.read())
fc6_funcs = [n.name for n in ast.walk(tree_fc6) if isinstance(n, ast.AsyncFunctionDef)]
for exp in ["forecast_cin7_demand", "get_cin7_sync_velocity", "get_cin7_forecast_health"]:
    check(f"p6 forecast endpoint {exp}", exp in fc6_funcs)

with open(os.path.join(_backend_dir, "src", "api", "routes", "ai", "cin7_anomaly.py")) as fh:
    tree_an6 = ast.parse(fh.read())
an6_funcs = [n.name for n in ast.walk(tree_an6) if isinstance(n, ast.AsyncFunctionDef)]
for exp in ["detect_cin7_anomalies", "get_cin7_sync_health", "get_cin7_anomaly_health"]:
    check(f"p6 anomaly endpoint {exp}", exp in an6_funcs)

p6_passed = passed - p1_passed - p2_passed - p3_passed - p4_passed - p5_passed
p6_failed = failed - p1_failed - p2_failed - p3_failed - p4_failed - p5_failed
print(f"  Phase 6: {p6_passed} passed, {p6_failed} failed")

# ============================================================
# PHASE 7: Frontend Dashboard (file existence + integration)
# ============================================================

_web_dir = os.path.abspath(os.path.join(_backend_dir, "..", "web"))

frontend_files = [
    os.path.join(_web_dir, "lib", "api", "cin7.ts"),
    os.path.join(_web_dir, "lib", "hooks", "use-cin7-stream.ts"),
    os.path.join(_web_dir, "app", "(dashboard)", "settings", "integrations", "components", "Cin7ConnectionCard.tsx"),
    os.path.join(_web_dir, "app", "(dashboard)", "settings", "integrations", "components", "Cin7SyncControls.tsx"),
    os.path.join(_web_dir, "components", "dashboard", "Cin7SyncStatusWidget.tsx"),
]

for fpath in frontend_files:
    fname = os.path.basename(fpath)
    check(f"p7 file exists {fname}", os.path.isfile(fpath))

# Check integrations page references Cin7
int_page = os.path.join(_web_dir, "app", "(dashboard)", "settings", "integrations", "page.tsx")
with open(int_page, encoding="utf-8") as fh:
    int_content = fh.read()
check("p7 integrations has Cin7ConnectionCard", "Cin7ConnectionCard" in int_content)
check("p7 integrations has Cin7SyncControls", "Cin7SyncControls" in int_content)

# Check dashboard page references Cin7SyncStatusWidget
dash_page = os.path.join(_web_dir, "app", "(dashboard)", "dashboard", "page.tsx")
with open(dash_page, encoding="utf-8") as fh:
    dash_content = fh.read()
check("p7 dashboard has Cin7SyncStatusWidget", "Cin7SyncStatusWidget" in dash_content)

p7_passed = passed - p1_passed - p2_passed - p3_passed - p4_passed - p5_passed - p6_passed
p7_failed = failed - p1_failed - p2_failed - p3_failed - p4_failed - p5_failed - p6_failed
print(f"  Phase 7: {p7_passed} passed, {p7_failed} failed")

print(f"\nAll Cin7 tests: {passed} passed, {failed} failed (Phase 1: {p1_passed}, Phase 2: {p2_passed}, Phase 3: {p3_passed}, Phase 4: {p4_passed}, Phase 5: {p5_passed}, Phase 6: {p6_passed}, Phase 7: {p7_passed})")
sys.exit(1 if failed > 0 else 0)
