"""Root conftest.py — collection configuration for the backend test suite."""

# Test files that reference backend modules not yet implemented or removed.
# These are skipped during collection to prevent CI failures.
# Remove entries here when the corresponding backend module is implemented.
collect_ignore = [
    # src.db.models.subscription was removed (SaaS cleanup)
    "tests/integration/test_api_endpoints.py",
    "tests/integration/test_webhooks.py",
    # Services not yet implemented (planned for future sprint)
    "tests/services/test_auto_reorder_integration.py",
    "tests/services/test_procurement_matching_integration.py",
    "tests/services/test_tax_calculator_integration.py",
]
