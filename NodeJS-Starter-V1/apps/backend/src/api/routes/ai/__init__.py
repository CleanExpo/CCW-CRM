"""AI API routes."""

from fastapi import APIRouter

from .learning import router as learning_router
from .monitoring import router as monitoring_router
from .specialized import router as specialized_router
from .supervisor import router as supervisor_router
from .test_data import router as test_data_router
from .test_failures import router as test_failures_router

# Main AI router that includes all sub-routers
ai_router = APIRouter(prefix="/api/ai", tags=["AI Agents"])

# Include sub-routers
ai_router.include_router(monitoring_router)
ai_router.include_router(supervisor_router)
ai_router.include_router(specialized_router)
ai_router.include_router(learning_router)
ai_router.include_router(test_data_router)
ai_router.include_router(test_failures_router)

__all__ = ["ai_router", "learning"]
