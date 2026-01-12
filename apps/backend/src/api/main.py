"""FastAPI application entry point."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from src.config import get_settings
from src.utils import get_logger, setup_logging

from .middleware.auth import AuthMiddleware
from .middleware.rate_limit import limiter
from .middleware.security_headers import SecurityHeadersMiddleware
from .routes import customers, demo_auth, demo_dashboard, demo_lists, health, inventory, orders, portal_auth, products, purchase_orders, quotes, service_requests, shipments, suppliers, test_data_gen
from .routes.ai import ai_router, chat, generate, insights, learning
from .routes.integrations import elevenlabs, sendgrid, shopify, xero

settings = get_settings()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan context manager."""
    setup_logging(debug=settings.debug)
    logger.info("Starting application", environment=settings.environment)

    # Initialize AI agents on startup
    logger.info("Initializing AI agent orchestration system")

    try:
        # Import and initialize specialized agents (registers them in registry)
        from src.ai.agents.specialized import (
            PricingAgent,
            ProcurementAgent,
            TaskExecutorAgent,
        )
        from src.ai.orchestration.supervisor_agent import get_supervisor_agent

        # Initialize agents (this registers them)
        pricing = PricingAgent()
        procurement = ProcurementAgent()
        executor = TaskExecutorAgent()
        supervisor = get_supervisor_agent()

        logger.info(
            "Agents initialized",
            agents=[
                pricing.agent_id,
                procurement.agent_id,
                executor.agent_id,
                "supervisor_agent",
            ],
        )

        # Start health monitoring background task
        from src.ai.monitoring import get_health_monitor

        health_monitor = get_health_monitor()
        await health_monitor.start()

        logger.info("Health monitor started", check_interval=health_monitor.check_interval)

        # Load patterns from database into learning engine
        from src.ai.learning import get_learning_engine

        learning_engine = get_learning_engine()
        try:
            loaded_count = await learning_engine.load_patterns_from_db()
            logger.info("Loaded patterns from database on startup", patterns_loaded=loaded_count)
        except Exception as load_error:
            logger.warning("Failed to load patterns from database", error=str(load_error))

    except Exception as e:
        logger.error("Failed to initialize AI system", error=str(e))
        # Don't fail startup, but log the error
        pass

    yield

    # Shutdown: Stop health monitor
    logger.info("Shutting down application")
    try:
        from src.ai.monitoring import get_health_monitor

        health_monitor = get_health_monitor()
        await health_monitor.stop()
        logger.info("Health monitor stopped")
    except Exception as e:
        logger.error("Error stopping health monitor", error=str(e))


app = FastAPI(
    title=settings.project_name,
    description="CCW Equipment Supplier ERP System API",
    version="1.0.0",
    lifespan=lifespan,
)

# Rate limiter state (for SlowAPI)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom middleware
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(AuthMiddleware)

# Include routers
app.include_router(health.router, tags=["Health"])
app.include_router(demo_auth.router, tags=["Authentication"])
app.include_router(demo_lists.router, tags=["Demo Lists"])
app.include_router(demo_dashboard.router, tags=["Dashboard"])
# CRUD routers registered after demo_lists to override read-only routes
app.include_router(products.router, tags=["Products"])
app.include_router(customers.router, tags=["Customers"])
app.include_router(orders.router, tags=["Orders"])
app.include_router(quotes.router, tags=["Quotes"])
# Multi-store inventory router
app.include_router(inventory.router, tags=["Multi-Store Inventory"])
# Service requests router
app.include_router(service_requests.router, tags=["Service Requests"])
# Customer portal authentication
app.include_router(portal_auth.router, tags=["Portal Auth"])
# Supplier management router
app.include_router(suppliers.router, tags=["Suppliers"])
# Purchase order router
app.include_router(purchase_orders.router, tags=["Purchase Orders"])
# Shipment tracking router
app.include_router(shipments.router, tags=["Shipment Tracking"])
# AI routers
app.include_router(ai_router)  # Main AI agent orchestration routes (includes learning router)
app.include_router(chat.router, tags=["AI Chat"])
app.include_router(insights.router, tags=["AI Insights"])
app.include_router(generate.router, tags=["AI Generation"])
# app.include_router(learning.router, tags=["AI Learning"])  # Already included in ai_router
app.include_router(test_data_gen.router)  # Test data generation for learning engine

# Integration routers
app.include_router(xero.router, prefix="/api", tags=["Xero Integration"])
app.include_router(shopify.router, tags=["Shopify Integration"])
app.include_router(sendgrid.router, tags=["SendGrid Integration"])
app.include_router(elevenlabs.router, tags=["ElevenLabs Integration"])


@app.get("/")
async def root() -> dict[str, str]:
    """Root endpoint."""
    return {"message": "CCW Equipment Supplier ERP API", "version": "1.0.0"}
