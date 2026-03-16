"""CRM Module test suite -- standalone runner (no pytest/conftest deps).

Tests pure logic and AST-verifies endpoint structure for:
- Contacts API (CRUD, customer-contact relationships)
- Activities API (CRUD, complete, N+1 fix, datetime)
- Customers API (response format, datetime)

Run: python apps/backend/tests/integration/test_crm_module.py
"""

import ast
import os
import sys
from datetime import UTC, datetime, timedelta, timezone

# Setup path so we can import from src.*
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

_backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
_pass = 0
_fail = 0


def check(label: str, condition: bool) -> None:
    global _pass, _fail
    if condition:
        _pass += 1
        print(f"  PASS: {label}")
    else:
        _fail += 1
        print(f"  FAIL: {label}")


# ================================================================
# 1. CRM Models structure
# ================================================================
print("\n=== 1. CRM Models ===")

from src.db.crm_models import Activity as ActivityModel
from src.db.crm_models import ActivityType, Contact as ContactModel

# Contact model fields
contact_cols = {c.name for c in ContactModel.__table__.columns}
check("Contact has id", "id" in contact_cols)
check("Contact has customer_id", "customer_id" in contact_cols)
check("Contact has first_name", "first_name" in contact_cols)
check("Contact has last_name", "last_name" in contact_cols)
check("Contact has email", "email" in contact_cols)
check("Contact has phone", "phone" in contact_cols)
check("Contact has mobile", "mobile" in contact_cols)
check("Contact has job_title", "job_title" in contact_cols)
check("Contact has is_primary", "is_primary" in contact_cols)
check("Contact has is_active", "is_active" in contact_cols)
check("Contact has created_at", "created_at" in contact_cols)
check("Contact has updated_at", "updated_at" in contact_cols)

# Activity model fields
activity_cols = {c.name for c in ActivityModel.__table__.columns}
check("Activity has id", "id" in activity_cols)
check("Activity has activity_type", "activity_type" in activity_cols)
check("Activity has subject", "subject" in activity_cols)
check("Activity has description", "description" in activity_cols)
check("Activity has customer_id", "customer_id" in activity_cols)
check("Activity has contact_id", "contact_id" in activity_cols)
check("Activity has order_id", "order_id" in activity_cols)
check("Activity has quote_id", "quote_id" in activity_cols)
check("Activity has due_date", "due_date" in activity_cols)
check("Activity has completed_at", "completed_at" in activity_cols)
check("Activity has created_at", "created_at" in activity_cols)

# ActivityType enum
check("ActivityType.CALL exists", ActivityType.CALL.value == "call")
check("ActivityType.EMAIL exists", ActivityType.EMAIL.value == "email")
check("ActivityType.MEETING exists", ActivityType.MEETING.value == "meeting")
check("ActivityType.NOTE exists", ActivityType.NOTE.value == "note")
check("ActivityType.TASK exists", ActivityType.TASK.value == "task")

# ================================================================
# 2. CRM Schemas validation
# ================================================================
print("\n=== 2. CRM Schemas ===")

from src.db.crm_schemas import (
    Activity as ActivitySchema,
    ActivityComplete,
    ActivityCreate,
    ActivityUpdate,
    ActivityWithRelations,
    Contact as ContactSchema,
    ContactCreate,
    ContactUpdate,
    ContactWithCustomer,
    PaginatedActivities,
    PaginatedContacts,
)

# PaginatedContacts uses 'data' field
check(
    "PaginatedContacts has 'data' field",
    "data" in PaginatedContacts.model_fields,
)
check(
    "PaginatedContacts has 'total' field",
    "total" in PaginatedContacts.model_fields,
)
check(
    "PaginatedContacts has 'page' field",
    "page" in PaginatedContacts.model_fields,
)

# PaginatedActivities uses 'data' field
check(
    "PaginatedActivities has 'data' field",
    "data" in PaginatedActivities.model_fields,
)
check(
    "PaginatedActivities has 'total' field",
    "total" in PaginatedActivities.model_fields,
)

# ContactCreate validation
contact_create = ContactCreate(
    first_name="John",
    last_name="Doe",
    email="john@example.com",
    phone="0412345678",
)
check("ContactCreate accepts valid data", contact_create.first_name == "John")
check("ContactCreate email is valid", contact_create.email == "john@example.com")

# ActivityCreate validation
activity_create = ActivityCreate(
    activity_type="call",
    subject="Follow-up call",
    description="Discussed pricing",
)
check("ActivityCreate accepts valid data", activity_create.subject == "Follow-up call")
check(
    "ActivityCreate activity_type default note",
    ActivityCreate(subject="test").activity_type.value == "note",
)

# ContactWithCustomer has customer_name field
check(
    "ContactWithCustomer has customer_name",
    "customer_name" in ContactWithCustomer.model_fields,
)

# ActivityWithRelations has all relation fields
check(
    "ActivityWithRelations has customer_name",
    "customer_name" in ActivityWithRelations.model_fields,
)
check(
    "ActivityWithRelations has contact_name",
    "contact_name" in ActivityWithRelations.model_fields,
)
check(
    "ActivityWithRelations has order_number",
    "order_number" in ActivityWithRelations.model_fields,
)
check(
    "ActivityWithRelations has quote_number",
    "quote_number" in ActivityWithRelations.model_fields,
)

# ActivityComplete schema
complete = ActivityComplete(completed_at=None)
check("ActivityComplete allows None completed_at", complete.completed_at is None)

# ================================================================
# 3. Datetime timezone awareness (no datetime.utcnow)
# ================================================================
print("\n=== 3. Datetime Timezone Awareness ===")

_crm_route_files = [
    os.path.join(_backend_dir, "src", "api", "routes", "customers.py"),
    os.path.join(_backend_dir, "src", "api", "routes", "contacts.py"),
    os.path.join(_backend_dir, "src", "api", "routes", "activities.py"),
]

for fpath in _crm_route_files:
    fname = os.path.basename(fpath)
    with open(fpath, "r", encoding="utf-8") as f:
        source = f.read()
    check(
        f"{fname} does not use datetime.utcnow()",
        "datetime.utcnow()" not in source,
    )
    check(
        f"{fname} imports UTC",
        "from datetime import UTC" in source or "from datetime import UTC," in source,
    )

# CRM models should use datetime.now(UTC)
models_path = os.path.join(_backend_dir, "src", "db", "crm_models.py")
with open(models_path, "r", encoding="utf-8") as f:
    models_source = f.read()
check(
    "crm_models.py uses datetime.now(UTC)",
    "datetime.now(UTC)" in models_source,
)
check(
    "crm_models.py does not use utcnow",
    "utcnow" not in models_source,
)

# ================================================================
# 4. AST Endpoint Verification
# ================================================================
print("\n=== 4. AST Endpoint Verification ===")


def _get_route_decorators(filepath: str) -> list[str]:
    """Extract all @router.get/post/put/delete paths from a file using AST."""
    with open(filepath, "r", encoding="utf-8") as f:
        tree = ast.parse(f.read())

    routes = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            for decorator in node.decorator_list:
                if isinstance(decorator, ast.Call) and isinstance(
                    decorator.func, ast.Attribute
                ):
                    attr = decorator.func
                    if (
                        isinstance(attr.value, ast.Name)
                        and attr.value.id == "router"
                        and attr.attr in ("get", "post", "put", "delete")
                    ):
                        method = attr.attr.upper()
                        path = ""
                        if decorator.args and isinstance(
                            decorator.args[0], ast.Constant
                        ):
                            path = decorator.args[0].value
                        routes.append(f"{method} {path}")
    return routes


# Customers endpoints
customers_routes = _get_route_decorators(
    os.path.join(_backend_dir, "src", "api", "routes", "customers.py")
)
check("Customers: GET list", "GET " in customers_routes)
check("Customers: GET by id", "GET /{customer_id}" in customers_routes)
check("Customers: POST create", "POST " in customers_routes)
check("Customers: PUT update", "PUT /{customer_id}" in customers_routes)
check("Customers: DELETE", "DELETE /{customer_id}" in customers_routes)

# Contacts endpoints
contacts_routes = _get_route_decorators(
    os.path.join(_backend_dir, "src", "api", "routes", "contacts.py")
)
check("Contacts: GET list", "GET " in contacts_routes)
check("Contacts: GET by id", "GET /{contact_id}" in contacts_routes)
check("Contacts: POST create", "POST " in contacts_routes)
check("Contacts: PUT update", "PUT /{contact_id}" in contacts_routes)
check("Contacts: DELETE", "DELETE /{contact_id}" in contacts_routes)
check(
    "Contacts: GET customer contacts",
    "GET /customer/{customer_id}" in contacts_routes,
)
check(
    "Contacts: POST set-primary",
    "POST /{contact_id}/set-primary" in contacts_routes,
)

# Activities endpoints
activities_routes = _get_route_decorators(
    os.path.join(_backend_dir, "src", "api", "routes", "activities.py")
)
check("Activities: GET list", "GET " in activities_routes)
check("Activities: GET by id", "GET /{activity_id}" in activities_routes)
check("Activities: POST create", "POST " in activities_routes)
check("Activities: PUT update", "PUT /{activity_id}" in activities_routes)
check("Activities: DELETE", "DELETE /{activity_id}" in activities_routes)
check(
    "Activities: POST complete",
    "POST /{activity_id}/complete" in activities_routes,
)
check(
    "Activities: GET customer activities",
    "GET /customer/{customer_id}" in activities_routes,
)
check(
    "Activities: GET contact activities",
    "GET /contact/{contact_id}" in activities_routes,
)
check(
    "Activities: GET pending tasks",
    "GET /pending-tasks" in activities_routes,
)

# Total endpoint count
total_crm_endpoints = len(customers_routes) + len(contacts_routes) + len(activities_routes)
check(f"Total CRM endpoints = {total_crm_endpoints} (expected >= 19)", total_crm_endpoints >= 19)

# ================================================================
# 5. N+1 Query Fix Verification (AST check for joinedload)
# ================================================================
print("\n=== 5. N+1 Query Fix ===")

activities_path = os.path.join(_backend_dir, "src", "api", "routes", "activities.py")
with open(activities_path, "r", encoding="utf-8") as f:
    activities_source = f.read()

check(
    "activities.py imports joinedload",
    "joinedload" in activities_source,
)
check(
    "activities.py uses joinedload(ActivityModel.customer)",
    "joinedload(ActivityModel.customer)" in activities_source,
)
check(
    "activities.py uses joinedload(ActivityModel.contact)",
    "joinedload(ActivityModel.contact)" in activities_source,
)
check(
    "activities.py uses joinedload(ActivityModel.order)",
    "joinedload(ActivityModel.order)" in activities_source,
)
check(
    "activities.py uses joinedload(ActivityModel.quote)",
    "joinedload(ActivityModel.quote)" in activities_source,
)

# ================================================================
# 6. Customer Existence Check in Contacts
# ================================================================
print("\n=== 6. Customer Existence Check ===")

contacts_path = os.path.join(_backend_dir, "src", "api", "routes", "contacts.py")
with open(contacts_path, "r", encoding="utf-8") as f:
    contacts_source = f.read()

check(
    "get_customer_contacts verifies customer exists",
    "Customer not found" in contacts_source,
)

# ================================================================
# 7. DB Exports
# ================================================================
print("\n=== 7. DB Package Exports ===")

from src.db import Activity, Contact

check("Contact exported from src.db", Contact is ContactModel)
check("Activity exported from src.db", Activity is ActivityModel)


# ================================================================
# Summary
# ================================================================
print(f"\n{'='*60}")
print(f"CRM Module Tests: {_pass} passed, {_fail} failed, {_pass + _fail} total")
print(f"{'='*60}")

if _fail > 0:
    sys.exit(1)
else:
    print("All CRM module tests passed!")
