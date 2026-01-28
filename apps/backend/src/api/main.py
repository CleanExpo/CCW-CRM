"""FastAPI application entry point."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy.exc import DatabaseError, IntegrityError, OperationalError
from starlette.exceptions import HTTPException as StarletteHTTPException

from src.config import get_settings
from src.utils import get_logger, setup_logging

from .exceptions import (
    database_error_handler,
    generic_exception_handler,
    http_exception_handler,
    integrity_error_handler,
    operational_error_handler,
    validation_exception_handler,
)
from .middleware.auth import AuthMiddleware
from .middleware.rate_limit import limiter
from .middleware.security_headers import SecurityHeadersMiddleware
from .routes import (
    # approvals,  # TODO: Implement approvals workflow
    autonomous_dev,
    backorders,
    config,
    containers,
    customers,
    demo_auth,
    demo_dashboard,
    demo_lists,
    health,
    inventory,
    jobs,
    orders,
    portal_auth,
    portal_forms,
    # prd,  # TODO: Fix PRD dependencies
    products,
    purchase_orders,
    quotes,
    recommendations,
    search,
    service_requests,
    shipments,
    suppliers,
    test_data_gen,
    translations,
    webhooks,
)
from .routes.ai import ai_router, chat, generate, insights
from .routes import google_ai, pos_transactions, pos_xero_reconciliation
from .routes.integrations import ap2, elevenlabs, sendgrid, shopify, shopify_theme, xero

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
        get_supervisor_agent()

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

    # Initialize Redis cache connection
    if settings.cache_enabled:
        from src.cache.redis_client import get_cache

        cache = get_cache()
        try:
            await cache.connect()
            logger.info(
                "Redis cache connected",
                host=settings.redis_host,
                port=settings.redis_port,
                db=settings.redis_db,
            )
        except Exception as cache_error:
            logger.warning("Redis connection failed, caching disabled", error=str(cache_error))

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

    # Shutdown: Disconnect Redis cache
    if settings.cache_enabled:
        try:
            from src.cache.redis_client import get_cache

            cache = get_cache()
            await cache.disconnect()
            logger.info("Redis cache disconnected")
        except Exception as cache_error:
            logger.error("Error disconnecting Redis cache", error=str(cache_error))


app = FastAPI(
    title=settings.project_name,
    description="""
# CCW Equipment Supplier ERP System API

Modern, AI-powered ERP system for equipment suppliers with comprehensive features:

## Core Features
- **Product Management**: Complete catalog management with multi-language support
- **Order Processing**: Sales orders, quotes, purchase orders with intelligent workflow
- **Inventory Management**: Real-time stock tracking, warehouse management, container tracking
- **Customer Management**: Customer profiles, service requests, portal access
- **AI-Powered Search**: Semantic search with vector embeddings and hybrid ranking
- **Product Recommendations**: Personalized and similar product suggestions
- **Multi-Language**: 10 languages supported (EN, ZH-CN, ZH-TW, ES, PT, AR, VI, HI, TA, TE)

## Integrations
- **Shopify**: E-commerce sync with metafields and theme APIs
- **Xero**: Accounting and payment sync
- **Google AP2**: Frictionless payments and voice commerce
- **AI Services**: OpenAI embeddings, Ollama for code generation

## AI & Automation
- **Semantic Search**: Natural language product search
- **Recommendations**: Collaborative and content-based filtering
- **Autonomous Development**: Self-improving system with AI agents
- **Agent Orchestration**: Intelligent task routing with supervisor pattern

## Authentication
All endpoints (except /health and /docs) require JWT authentication.
Include the JWT token in the Authorization header: `Bearer <token>`

## Rate Limiting
API endpoints are rate-limited to prevent abuse:
- Default: 100 requests/minute per IP
- Authentication: 10 requests/minute per IP
- Search: 60 requests/minute per user

## Pagination
List endpoints support pagination with these parameters:
- `page`: Page number (default: 1, min: 1)
- `page_size`: Items per page (default: 50, min: 1, max: 100)

Response includes pagination metadata:
```json
{
  "data": [...],
  "total": 1000,
  "page": 1,
  "page_size": 50,
  "total_pages": 20
}
```

## Error Handling
All errors return JSON with this format:
```json
{
  "detail": "Error description",
  "status_code": 400,
  "type": "validation_error"
}
```

## Performance
- P95 Response Time: <500ms for most endpoints
- Search P95: <500ms
- Recommendations P95: <200ms
- Uptime SLA: 99.9%
    """,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    contact={
        "name": "CCW ERP Support",
        "url": "https://ccw-erp.example.com/support",
        "email": "support@ccw-erp.example.com",
    },
    license_info={
        "name": "Proprietary",
        "url": "https://ccw-erp.example.com/license",
    },
    servers=[
        {
            "url": "http://localhost:8000",
            "description": "Development server",
        },
        {
            "url": "https://api.ccw-erp.example.com",
            "description": "Production server",
        },
    ],
    tags_metadata=[
        {
            "name": "Health",
            "description": "Health check and system status endpoints",
        },
        {
            "name": "Authentication",
            "description": "User authentication and session management",
        },
        {
            "name": "Products",
            "description": "Product catalog management with full CRUD operations",
        },
        {
            "name": "Customers",
            "description": "Customer relationship management",
        },
        {
            "name": "Orders",
            "description": "Sales order processing and management",
        },
        {
            "name": "Quotes",
            "description": "Quote generation and management",
        },
        {
            "name": "Purchase Orders",
            "description": "Supplier purchase order management",
        },
        {
            "name": "Inventory",
            "description": "Stock management and warehouse operations",
        },
        {
            "name": "AI Search",
            "description": "Semantic search with vector embeddings and hybrid ranking",
        },
        {
            "name": "AI Recommendations",
            "description": "Product recommendations using collaborative and content-based filtering",
        },
        {
            "name": "Integrations",
            "description": "Third-party integrations (Shopify, Xero, AP2)",
        },
        {
            "name": "Autonomous Development",
            "description": "AI-powered autonomous development and deployment system",
        },
        {
            "name": "Translations",
            "description": "Multi-language content management",
        },
        {
            "name": "Dashboard",
            "description": "Analytics and business intelligence",
        },
    ],
)

# Prometheus metrics instrumentation
# Exposes /metrics endpoint for Prometheus scraping
Instrumentator().instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)

# Rate limiter state (for SlowAPI)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Global exception handlers (order matters - most specific first, generic last)
# These ensure ALL errors return JSON, preventing HTML error pages that cause JSONDecodeError
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(IntegrityError, integrity_error_handler)
app.add_exception_handler(OperationalError, operational_error_handler)
app.add_exception_handler(DatabaseError, database_error_handler)
app.add_exception_handler(Exception, generic_exception_handler)  # MUST BE LAST - catch-all

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
app.include_router(config.router, tags=["Configuration"])
# app.include_router(approvals.router, tags=["Approvals"])  # TODO: Implement approvals
app.include_router(demo_auth.router, tags=["Authentication"])
app.include_router(demo_lists.router, tags=["Demo Lists"])
app.include_router(demo_dashboard.router, tags=["Dashboard"])
# CRUD routers registered after demo_lists to override read-only routes
app.include_router(products.router, tags=["Products"])
app.include_router(customers.router, tags=["Customers"])
app.include_router(orders.router, tags=["Orders"])
app.include_router(quotes.router, tags=["Quotes"])
# Background jobs router
app.include_router(jobs.router, tags=["Background Jobs"])
# Multi-store inventory router
app.include_router(inventory.router, tags=["Multi-Store Inventory"])
# Service requests router
app.include_router(service_requests.router, tags=["Service Requests"])
# Customer portal authentication
app.include_router(portal_auth.router, tags=["Portal Auth"])
# Portal forms (contact submissions, demo requests)
app.include_router(portal_forms.router, tags=["Portal Forms"])
# Webhooks
app.include_router(webhooks.router, tags=["Webhooks"])
# Supplier management router
app.include_router(suppliers.router, tags=["Suppliers"])
# Purchase order router
app.include_router(purchase_orders.router, tags=["Purchase Orders"])
# Shipment tracking router
app.include_router(shipments.router, tags=["Shipment Tracking"])
# Container tracking and backorder management
app.include_router(containers.router, tags=["Container Tracking"])
app.include_router(backorders.router, tags=["Backorder Management"])
# AI routers
app.include_router(ai_router)  # Main AI agent orchestration routes (includes learning router)
app.include_router(chat.router, tags=["AI Chat"])
app.include_router(insights.router, tags=["AI Insights"])
app.include_router(generate.router, tags=["AI Generation"])
# app.include_router(learning.router, tags=["AI Learning"])  # Already included in ai_router
app.include_router(test_data_gen.router)  # Test data generation for learning engine

# AI Search & Recommendations
app.include_router(search.router)  # Semantic & hybrid search
app.include_router(recommendations.router)  # Product recommendations

# Autonomous Development
app.include_router(autonomous_dev.router)  # Autonomous development orchestration

# Translation management router
app.include_router(translations.router, tags=["Translation Management"])

# Integration routers
app.include_router(xero.router, prefix="/api", tags=["Xero Integration"])
app.include_router(shopify.router, tags=["Shopify Integration"])
app.include_router(shopify_theme.router, tags=["Shopify Theme APIs"])
app.include_router(sendgrid.router, tags=["SendGrid Integration"])
app.include_router(elevenlabs.router, tags=["ElevenLabs Integration"])
app.include_router(ap2.router, tags=["AP2 Integration"])
app.include_router(google_ai.router, tags=["Google AI"])

# POS routers
app.include_router(pos_transactions.router, tags=["POS"])
app.include_router(pos_xero_reconciliation.router, tags=["POS Xero Reconciliation"])

# PRD Generation router
# app.include_router(prd.router, tags=["PRD Generation"])  # TODO: Fix PRD dependencies


@app.get("/")
async def root() -> dict[str, str]:
    """Root endpoint."""
    return {"message": "CCW Equipment Supplier ERP API", "version": "1.0.0"}
