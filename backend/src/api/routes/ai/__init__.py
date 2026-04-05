"""AI API routes."""

from __future__ import annotations

import structlog
from fastapi import APIRouter

logger = structlog.get_logger(__name__)

# Main AI router that includes all sub-routers
ai_router = APIRouter(prefix="/api/ai", tags=["AI Agents"])

# Conditionally import and include sub-routers (some depend on langgraph/ollama)
_route_modules = [
    (".anomaly", "anomaly_router"),
    (".assets", "assets_router"),
    (".document_parser", "document_parser_router"),
    (".form_autofill", "form_autofill_router"),
    (".generate", "generate_router"),
    (".inventory_forecast", "inventory_forecast_router"),
    (".learning", "learning_router"),
    (".monitoring", "monitoring_router"),
    (".specialized", "specialized_router"),
    (".supervisor", "supervisor_router"),
    (".test_data", "test_data_router"),
    (".test_failures", "test_failures_router"),
    (".protocol", "protocol_router"),
]

for module_name, router_attr in _route_modules:
    try:
        import importlib
        mod = importlib.import_module(module_name, package=__name__)
        router = getattr(mod, "router", None)
        if router:
            ai_router.include_router(router)
    except (ImportError, Exception) as e:
        logger.warning(
            f"Skipping AI route {module_name}: {e}",
            module=module_name,
            error=str(e),
        )

__all__ = ["ai_router"]
