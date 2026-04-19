"""Auth-enforcement tests for the Supplier Portal (UNI-1869).

Standalone logic tests that avoid the shared conftest fixture stack
(pre-existing import error). These prove the router-level auth
dependency is wired up and the helper behaves. Integration tests in
``test_supplier_portal.py`` still cover the happy paths once the
conftest is restored.
"""

from unittest.mock import MagicMock


def test_supplier_portal_requires_auth_dependency():
    """The supplier_portal router must declare Depends(get_current_user) at the
    router level so every handler below it inherits auth enforcement.
    Regression guard for the UNI-1869 fix."""
    from fastapi import Depends

    from src.api.deps import get_current_user
    from src.api.routes import supplier_portal

    router = supplier_portal.router
    dep_callables = [
        getattr(dep, "dependency", None) for dep in (router.dependencies or [])
    ]
    assert get_current_user in dep_callables, (
        "supplier_portal router must inject get_current_user at the router "
        "level so unauthenticated callers get 401 before the handler runs"
    )
    # Depends wrapper is in use.
    sample = Depends(lambda: None)
    assert any(isinstance(dep, type(sample)) for dep in (router.dependencies or []))


def test_resolve_supplier_id_returns_demo_for_known_domain():
    """_resolve_supplier_id maps the live demo supplier's email domain to the
    canonical demo supplier id. TODO path until a real users.supplier_id FK
    lands."""
    from src.api.routes.supplier_portal import _DEMO_SUPPLIER_ID, _resolve_supplier_id

    user = MagicMock()
    user.email = "orders@cleantech.com.au"
    assert _resolve_supplier_id(user) == _DEMO_SUPPLIER_ID


def test_resolve_supplier_id_falls_back_to_demo_for_unknown_domain():
    """Unknown emails fall back to the demo supplier (documented TODO)."""
    from src.api.routes.supplier_portal import _DEMO_SUPPLIER_ID, _resolve_supplier_id

    user = MagicMock()
    user.email = "stranger@example.com"
    assert _resolve_supplier_id(user) == _DEMO_SUPPLIER_ID


def test_resolve_supplier_id_handles_missing_email():
    """Gracefully handles a User with no email (e.g., fresh test fixtures)."""
    from src.api.routes.supplier_portal import _DEMO_SUPPLIER_ID, _resolve_supplier_id

    user = MagicMock()
    user.email = None
    assert _resolve_supplier_id(user) == _DEMO_SUPPLIER_ID
