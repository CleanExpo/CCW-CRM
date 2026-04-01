"""Specialized AI agents."""
from __future__ import annotations

# Conditional imports - these agents require langgraph/ollama which may not be available
try:
    from .anomaly_detection_agent import AnomalyDetectionAgent
    from .cin7_anomaly_agent import Cin7AnomalyAgent
    from .cin7_forecasting_agent import Cin7ForecastingAgent
    from .development_agent import DevelopmentAgent
    from .document_parser_agent import DocumentParserAgent
    from .form_autofill_agent import FormAutoFillAgent
    from .inventory_forecasting_agent import InventoryForecastingAgent
    from .pricing_agent import PricingAgent, get_pricing_agent
    from .procurement_agent import ProcurementAgent, get_procurement_agent
    from .recommendation_agent import RecommendationAgent
    from .search_agent import SearchAgent
    from .task_executor_agent import TaskExecutorAgent, get_task_executor_agent
    from .testing_agent import TestingAgent
except ImportError:
    AnomalyDetectionAgent = None  # type: ignore[assignment, misc]
    Cin7AnomalyAgent = None  # type: ignore[assignment, misc]
    Cin7ForecastingAgent = None  # type: ignore[assignment, misc]
    DevelopmentAgent = None  # type: ignore[assignment, misc]
    DocumentParserAgent = None  # type: ignore[assignment, misc]
    FormAutoFillAgent = None  # type: ignore[assignment, misc]
    InventoryForecastingAgent = None  # type: ignore[assignment, misc]
    PricingAgent = None  # type: ignore[assignment, misc]
    get_pricing_agent = None  # type: ignore[assignment]
    ProcurementAgent = None  # type: ignore[assignment, misc]
    get_procurement_agent = None  # type: ignore[assignment]
    RecommendationAgent = None  # type: ignore[assignment, misc]
    SearchAgent = None  # type: ignore[assignment, misc]
    TaskExecutorAgent = None  # type: ignore[assignment, misc]
    get_task_executor_agent = None  # type: ignore[assignment]
    TestingAgent = None  # type: ignore[assignment, misc]

__all__ = [
    "AnomalyDetectionAgent",
    "Cin7AnomalyAgent",
    "Cin7ForecastingAgent",
    "DevelopmentAgent",
    "DocumentParserAgent",
    "FormAutoFillAgent",
    "InventoryForecastingAgent",
    "PricingAgent",
    "get_pricing_agent",
    "ProcurementAgent",
    "get_procurement_agent",
    "RecommendationAgent",
    "SearchAgent",
    "TaskExecutorAgent",
    "get_task_executor_agent",
    "TestingAgent",
]
