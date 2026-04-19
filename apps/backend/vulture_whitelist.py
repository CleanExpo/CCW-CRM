"""Vulture whitelist — names that appear unused but must be kept.

Vulture suppresses a warning when the name appears anywhere in scanned files.
Declaring names here as class attributes achieves that without modifying source.

Categories:
  - Function/method parameters that are part of a declared public API
  - SQLAlchemy event handler params required by the framework signature
  - Imports inside the locked demo_models.py (cannot be modified)
"""


class _Whitelist:
    # risk_assessor.py — assess_change_risk() public API parameters
    diff = None
    commit_message = None

    # inventory_intelligence.py — execute() future geolocation parameter
    customer_location = None

    # tenant_isolation.py — SQLAlchemy before_execute event handler
    # Framework calls with (conn, clauseelement, multiparams, params, execution_options)
    execution_options = None
    multiparams = None

    # backorders.py — FastAPI request body declared but body NYI
    notify_data = None

    # amex.py — tokenize_card() card detail parameters
    cvv = None
    expiry = None

    # pr_automation.py — commit_changes() default author parameter
    author = None

    # demo_models.py — locked file; these imports cannot be removed
    i18n_models = None
    inventory_models = None
