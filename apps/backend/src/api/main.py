"""FastAPI application entry point."""
from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy.exc import DatabaseError, IntegrityError, OperationalError
from starlette.exceptions import HTTPException as StarletteHTTPException

from src.config import get_settings
from src.db import indexes as _indexes  # noqa: F401 - registers composite indexes with SQLAlchemy metadata
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
from .middleware.request_id import RequestIdMiddleware
from .middleware.security_headers import SecurityHeadersMiddleware
from .routes import (
    activities,  # CRM activities
    agents_monitor,  # Agent monitoring dashboard (UNI-1246)
    approvals,
    audit_trail,  # Entity-level audit trail
    backorders,
    bank_feeds,
    bas_report,  # BAS report generation (UNI-1816)
    billing,  # Billing and payment endpoints (Phase 2 Batch 2A)
    boardroom,  # Boardroom AI session endpoint (4x daily CRON)
    certifications,  # IICRC/ISSA/ARCR certification tracking (Sprint 2)
    config,
    contacts,  # CRM contacts
    containers,
    contractors,  # Contractor availability management
    crm_health,  # CRM client health scoring (UNI-1114)
    crm_onboarding,  # CRM onboarding sequences Day-1/7/30 (UNI-1113)
    crm_personas,  # CRM persona tagging (UNI-1112)
    cron_jobs,  # Scheduled task endpoints (Vercel Cron)
    customer_orders,
    customers,
    demo_auth,
    demo_dashboard,
    demo_lists,
    email_audit,  # Email audit trail for GDPR compliance (ISS-037)
    eod_reconciliation,  # EOD cash reconciliation (UNI-1849)
    equipment_lifecycle,  # Equipment serial numbers + warranty tracking (Sprint 2)
    google_ai,
    health,
    inventory,
    invoice_payments,  # Invoice payments for UNI-173
    invoices,  # Invoices for UNI-173
    jobs,
    orders,
    pos_transactions,
    prd,
    pricing,  # Customer trade pricing tiers (Sprint 2)
    procurement,
    product_variants,  # Product variant CRUD + Shopify sync (UNI-1867, UNI-1866)
    products,
    prometheus_metrics,  # Prometheus metrics endpoint
    public_stats,  # Public landing page stats (no auth required)
    purchase_orders,
    quotes,
    receipts,  # Digital receipts + thermal printer (UNI-1845)
    reconciliation,
    reconciliation_dashboard,
    service_requests,
    shipments,
    stripe_connection,  # Stripe API connection management (UNI-1859)
    stripe_webhooks,  # Stripe webhook receiver
    suppliers,
    team,
    tpar,  # TPAR data collection (UNI-1863)
    tracking_notifications,  # Customer tracking notifications (UNI-1851)
    translations,
    warehouse,  # Warehouse operations feed (UNI-1251)
    webhooks,
    xero_tracking,
)
from .routes import (
    settings as settings_routes,  # Account and company settings
)

# AI-dependent routes - conditional import (requires langchain/langgraph)
_ai_routes_available = False
try:
    from .routes import autonomous_dev, recommendations, search, test_data_gen
    from .routes.ai import ai_router, chat, generate, insights
    from .routes.ai import inventory_forecast as ai_inventory_forecast
    _ai_routes_available = True
except ImportError:
    autonomous_dev = recommendations = search = test_data_gen = ai_inventory_forecast = None  # type: ignore[assignment]

from .routes.integrations import (
    anthropic as anthropic_integration,
)
from .routes.integrations import (
    ap2,
    cin7,
    cin7_crm,
    cin7_line_items,
    cin7_procurement,
    cin7_stream,
    cin7_sync,
    cin7_webhooks,
    elevenlabs,
    marketplace,
    sendgrid,
    shopify,
    shopify_theme,
    xero,
)

settings = get_settings()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan context manager."""
    setup_logging(debug=settings.debug, betterstack_token=settings.betterstack_source_token)
    logger.info("Starting application", environment=settings.environment)

    # Validate production secrets at startup — fail fast on misconfiguration
    secret_issues = settings.validate_production_secrets()
    if secret_issues:
        for issue in secret_issues:
            logger.error("Production secret misconfiguration", issue=issue)
        if settings.is_production:
            raise RuntimeError(
                f"Production startup blocked — {len(secret_issues)} secret(s) misconfigured: "
                + "; ".join(secret_issues)
            )

    # Initialize Sentry for error tracking
    try:
        from src.integrations.sentry_client import initialize_sentry
        initialize_sentry()
    except Exception as e:
        logger.warning("Failed to initialize Sentry", error=str(e))

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
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
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
            "name": "Contacts",
            "description": "Contact management - multiple contacts per customer",
        },
        {
            "name": "Activities",
            "description": "CRM activity tracking - calls, emails, meetings, notes, tasks",
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

# Rate limiting middleware — activates default_limits on all routes (slowapi)
app.add_middleware(SlowAPIMiddleware)

# Custom middleware
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(AuthMiddleware)
app.add_middleware(RequestIdMiddleware)

# Performance monitoring middleware
from src.api.middleware.performance import PerformanceMiddleware, get_performance_metrics

performance_metrics = get_performance_metrics()
app.add_middleware(PerformanceMiddleware, metrics=performance_metrics)

# Include routers
app.include_router(health.router, tags=["Health"])
app.include_router(public_stats.router, tags=["Public"])
app.include_router(prometheus_metrics.router, tags=["Monitoring"])  # Prometheus metrics
app.include_router(config.router, tags=["Configuration"])
app.include_router(approvals.router, tags=["Approvals"])
app.include_router(audit_trail.router, tags=["Audit Trail"])
# app.include_router(auth_signup.router, tags=["Signup"])  # TODO: auth_signup not implemented yet
app.include_router(demo_auth.router, tags=["Authentication"])
app.include_router(demo_lists.router, tags=["Demo Lists"])
app.include_router(demo_dashboard.router, tags=["Dashboard"])
# CRUD routers registered after demo_lists to override read-only routes
app.include_router(products.router, tags=["Products"])
app.include_router(product_variants.router, tags=["Product Variants"])
app.include_router(customers.router, tags=["Customers"])
app.include_router(contacts.router, tags=["Contacts"])  # CRM Contacts
app.include_router(activities.router, tags=["Activities"])  # CRM Activities
app.include_router(customer_orders.router, tags=["Customer Orders"])
app.include_router(orders.router, tags=["Orders"])
app.include_router(quotes.router, tags=["Quotes"])
# BAS Report (UNI-1816)
app.include_router(bas_report.router, tags=["BAS Report"])
# Invoicing & Payments (UNI-173)
app.include_router(invoices.router, tags=["Invoices"])
app.include_router(invoice_payments.router, tags=["Invoice Payments"])
# Billing & Payment Methods (Phase 2 Batch 2A)
app.include_router(billing.router, tags=["Billing"])
# Background jobs router
app.include_router(jobs.router, tags=["Background Jobs"])
# Multi-store inventory router
app.include_router(inventory.router, tags=["Multi-Store Inventory"])
# Service requests router
app.include_router(service_requests.router, tags=["Service Requests"])
# Webhooks
app.include_router(webhooks.router, tags=["Webhooks"])
# Boardroom AI session endpoint (4x daily CRON)
app.include_router(boardroom.router, tags=["Boardroom"])
# Stripe webhook receiver (invoice.paid, invoice.payment_failed, subscription.updated, checkout)
app.include_router(stripe_webhooks.router, tags=["Stripe Webhooks"])
# Stripe connection management (UNI-1859)
app.include_router(stripe_connection.router, tags=["Stripe Connection"])
# Customer tracking notifications (UNI-1851)
app.include_router(tracking_notifications.router, tags=["Tracking Notifications"])
# Supplier management router
app.include_router(suppliers.router, tags=["Suppliers"])
# Team management router (multi-tenant user management)
app.include_router(team.router, tags=["Team Management"])
# Contractor availability management router
app.include_router(contractors.router, tags=["Contractors"])
# Cron job endpoints (Vercel Cron / scheduled tasks)
app.include_router(cron_jobs.router, tags=["Cron Jobs"])
# CRM health scoring, onboarding sequences, and persona tagging (UNI-1112/1113/1114)
app.include_router(crm_health.router, tags=["CRM Health"])
app.include_router(crm_onboarding.router, tags=["CRM Onboarding"])
app.include_router(crm_personas.router, tags=["CRM Personas"])
# Sprint 2 — Industry DNA: Equipment lifecycle, IICRC certifications, pricing tiers
app.include_router(equipment_lifecycle.router, tags=["Equipment Lifecycle"])
app.include_router(certifications.router, tags=["Certifications"])
app.include_router(pricing.router, tags=["Pricing Tiers"])
# Account and company settings
app.include_router(settings_routes.router, tags=["Settings"])
# Agent monitoring dashboard
app.include_router(agents_monitor.router, tags=["Agent Monitoring"])
# TPAR — Taxable Payments Annual Report (UNI-1863)
app.include_router(tpar.router, tags=["TPAR"])
app.include_router(warehouse.router, tags=["Warehouse"])
# Purchase order router
app.include_router(purchase_orders.router, tags=["Purchase Orders"])
# Procurement three-way match and unmatched PO items
app.include_router(procurement.router, tags=["Procurement"])
# Shipment tracking router
app.include_router(shipments.router, tags=["Shipment Tracking"])
app.include_router(shipments.webhook_router, tags=["Shipping Webhooks"])
# Container tracking and backorder management
app.include_router(containers.router, tags=["Container Tracking"])
app.include_router(backorders.router, tags=["Backorder Management"])
# AI routers (conditional - requires langchain/langgraph packages)
if _ai_routes_available:
    app.include_router(ai_router)  # Main AI agent orchestration routes
    app.include_router(chat.router, tags=["AI Chat"])
    app.include_router(insights.router, tags=["AI Insights"])
    app.include_router(generate.router, tags=["AI Generation"])
    app.include_router(test_data_gen.router)  # Test data generation for learning engine
    if ai_inventory_forecast is not None:
        app.include_router(ai_inventory_forecast.router, tags=["AI Inventory Forecasting"])

# AI Search & Recommendations
try:
    app.include_router(search.router)  # Semantic & hybrid search
    app.include_router(recommendations.router)  # Product recommendations
except (ImportError, AttributeError):
    pass  # Skip if AI dependencies not available

# Autonomous Development
try:
    app.include_router(autonomous_dev.router)
except (ImportError, AttributeError):
    pass  # Skip if AI dependencies not available

# Autonomy Metrics
from .routes import autonomy_metrics

app.include_router(autonomy_metrics.router, tags=["Autonomy Metrics"])

# Command Parser (Phase 1: /build command infrastructure)
try:
    from .routes.ai import command_parser
    app.include_router(command_parser.router, tags=["Command Parser"])
except (ImportError, AttributeError):
    pass  # Skip if AI dependencies not available

# Build Command (Phase 2: /build command handler)
try:
    from .routes.ai import build_command
    app.include_router(build_command.router, tags=["Build Command"])
except (ImportError, AttributeError, IndexError, OSError):
    pass  # Skip if AI dependencies not available or path depth wrong (Docker)

# Approval Gates (Phase 3: approval gate system)
try:
    from .routes.ai import approval_gates
    app.include_router(approval_gates.router, tags=["Approval Gates"])
except (ImportError, AttributeError, IndexError, OSError):
    pass  # Skip if AI dependencies not available or path depth wrong (Docker)

# Gap Sync (Phase 4: gap-to-linear orchestrator)
try:
    from .routes.ai import gap_sync
    app.include_router(gap_sync.router, tags=["Gap Sync"])
except (ImportError, AttributeError, IndexError, OSError):
    pass  # Skip if AI dependencies not available or path depth wrong (Docker)

# Requirement Verification (Phase 5: requirement tracing)
try:
    from .routes.ai import requirement_verification
    app.include_router(requirement_verification.router, tags=["Requirement Verification"])
except (ImportError, AttributeError, IndexError, OSError):
    pass  # Skip if AI dependencies not available or path depth wrong (Docker)

# Analytics Metrics
try:
    from .routes import analytics
    app.include_router(analytics.router, tags=["Analytics"])
except ImportError:
    pass

# Autonomy Metrics (imported at top of file)
app.include_router(autonomy_metrics.router, tags=["Autonomy Metrics"])

# Translation management router (✅ IMPLEMENTED)
app.include_router(translations.router, tags=["Translation Management"])

# Integration routers (✅ ALL IMPLEMENTED)
app.include_router(xero.router, prefix="/api", tags=["Xero Integration"])
app.include_router(xero_tracking.router, tags=["Xero Tracking"])
app.include_router(shopify.router, tags=["Shopify Integration"])
app.include_router(shopify_theme.router, tags=["Shopify Theme APIs"])
app.include_router(sendgrid.router, tags=["SendGrid Integration"])
app.include_router(anthropic_integration.router, tags=["Anthropic Integration"])
app.include_router(elevenlabs.router, tags=["ElevenLabs Integration"])
app.include_router(ap2.router, tags=["AP2 Integration"])
app.include_router(marketplace.router, tags=["Marketplace Integration"])
app.include_router(cin7.router, tags=["Cin7 Integration"])
app.include_router(cin7_sync.router, tags=["Cin7 Sync"])
app.include_router(cin7_crm.router, tags=["Cin7 CRM Sync"])
app.include_router(cin7_procurement.router, tags=["Cin7 Procurement Sync"])
app.include_router(cin7_webhooks.router, tags=["Cin7 Webhooks"])
app.include_router(cin7_stream.router, tags=["Cin7 Real-Time"])
app.include_router(cin7_line_items.router, tags=["Cin7 Line Items"])

# Cin7 Goods Receipt Notes (GRN workflow — UNI-1266)
try:
    from src.api.routes.integrations import cin7_grn
    app.include_router(cin7_grn.router, tags=["Cin7 GRN"])
except ImportError:
    pass

# Cin7 Webhook Subscription Management (UNI-1267)
try:
    from src.api.routes.integrations import cin7_webhook_subscriptions
    app.include_router(cin7_webhook_subscriptions.router, tags=["Cin7 Webhook Subscriptions"])
except ImportError:
    pass  # Skip if dependencies not available

# Cin7 Inventory Write-Back — adjustments, transfers, stock-takes (UNI-1265)
try:
    from src.api.routes.integrations import cin7_inventory_writeback
    app.include_router(cin7_inventory_writeback.router, tags=["Cin7 Inventory Write-Back"])
except ImportError:
    pass

# Cin7 BOM (Bill of Materials) + Production Runs (UNI-1268)
try:
    from src.api.routes.integrations import cin7_bom
    from src.db import cin7_bom_models as _cin7_bom_models  # noqa: F401 - registers models with SQLAlchemy metadata
    app.include_router(cin7_bom.router, tags=["Cin7 BOM"])
except ImportError:
    pass

# Cin7 Sales Order Fulfilment Chain — pick/pack/ship + invoice + payments (UNI-1264)
try:
    from src.api.routes.integrations import cin7_fulfilment
    from src.db import cin7_fulfilment_models as _cin7_fulfilment_models  # noqa: F401
    app.include_router(cin7_fulfilment.router, tags=["Cin7 Fulfilment"])
except ImportError:
    pass

# Cin7 Shadow Transition System Phase A — gap poller + detection (UNI-1260)
try:
    from src.api.routes.integrations import cin7_shadow_sync
    from src.db import cin7_shadow_models as _  # noqa: F401,F811 - registers models with SQLAlchemy metadata
    app.include_router(cin7_shadow_sync.router, tags=["Cin7 Shadow Sync"])
except ImportError:
    pass

# Cin7 Financial/GL Integration — ChartOfAccounts, Journals, AccountMappings (UNI-1269)
try:
    from src.api.routes.integrations import cin7_gl
    from src.db import cin7_gl_models as _cin7_gl_models  # noqa: F401 - registers GL models with SQLAlchemy metadata
    app.include_router(cin7_gl.router, tags=["Cin7 Financial/GL"])
except ImportError:
    pass

app.include_router(google_ai.router, tags=["Google AI"])

# Sprint 2 — Industry DNA models (register with SQLAlchemy metadata)
import src.db.certification_models  # noqa: F401
import src.db.equipment_lifecycle_models  # noqa: F401
import src.db.pricing_models  # noqa: F401

# Workflow Automation, SLA, and In-App Notification models (UNI-174)
import src.db.workflow_models  # noqa: F401 - registers tables with SQLAlchemy metadata

# Workflow, SLA, and Notification API routes (UNI-174 ST-4)
try:
    from src.api.routes.workflows import router as workflows_router
    app.include_router(workflows_router)
except ImportError:
    pass

try:
    from src.api.routes.sla import router as sla_router
    app.include_router(sla_router)
except ImportError:
    pass

try:
    from src.api.routes.notifications import router as notifications_router
    app.include_router(notifications_router)
except ImportError:
    pass

# Cin7 AI agents (forecasting + anomaly detection)
try:
    from src.api.routes.ai import cin7_anomaly, cin7_forecast
    app.include_router(cin7_forecast.router, tags=["Cin7 AI Forecasting"])
    app.include_router(cin7_anomaly.router, tags=["Cin7 AI Anomaly Detection"])
except (ImportError, AttributeError):
    pass  # AI agents not available without langgraph

# Project Intelligence Agent (codebase auditing + gap analysis)
try:
    from src.api.routes.ai import project_intelligence
    app.include_router(project_intelligence.router, tags=["Project Intelligence"])
except (ImportError, AttributeError, IndexError, OSError):
    pass  # Skip if dependencies not available or path depth wrong (Docker)

# Toolshed API (context bundle assembly + quality gates — Minions framework)
try:
    from src.api.routes.ai import toolshed
    app.include_router(toolshed.router, tags=["Toolshed"])
except (ImportError, AttributeError, IndexError, OSError):
    pass  # Skip if dependencies not available or path depth wrong (Docker)

# Cin7 Shadow AI Agent — gap analysis + auto-resolution (UNI-1262)
try:
    from src.api.routes.ai import cin7_shadow_ai
    app.include_router(cin7_shadow_ai.router, tags=["Cin7 Shadow AI"])
except ImportError:
    pass

# Marketing AI Agent — campaign generation + audience analysis (UNI-857)
try:
    from src.api.routes.ai import marketing_ai
    app.include_router(marketing_ai.router, tags=["AI Marketing"])
except ImportError:
    pass

# Staff Copilot AI Agent — operational ERP/CRM queries (UNI-857)
try:
    from src.api.routes.ai import staff_copilot as ai_copilot
    app.include_router(ai_copilot.router, tags=["Staff Copilot"])
except ImportError:
    pass

# Sprint 3 — AI Autonomy Layer
# Autonomous Ops Agent — Claude Sonnet 4.6 ERP decision engine
try:
    from src.api.routes.ai import autonomous_ops
    app.include_router(autonomous_ops.router, tags=["Autonomous Ops"])
except ImportError:
    pass

# NL ERP Query Agent — natural language → SQL → answer
try:
    from src.api.routes.ai import query as ai_query
    app.include_router(ai_query.router, tags=["NL ERP Query"])
except ImportError:
    pass

# Document Extraction — Claude Vision invoice/PO OCR
try:
    from src.api.routes import documents as document_extraction
    app.include_router(document_extraction.router, tags=["Document Extraction"])
except ImportError:
    pass

# Sprint 4 — Customer & Supplier Portals
try:
    from src.api.routes.portal import customer_portal
    app.include_router(customer_portal.router, tags=["Customer Portal"])
except ImportError:
    pass

try:
    from src.api.routes import supplier_portal
    app.include_router(supplier_portal.router, tags=["Supplier Portal"])
except ImportError:
    pass

# POS-Xero Reconciliation (depends on Xero integration)
try:
    from src.api.routes import pos_xero_reconciliation
    app.include_router(pos_xero_reconciliation.router, tags=["POS Xero Reconciliation"])
except (ImportError, AttributeError):
    pass  # Skip if Xero dependencies not available

# Email Audit Trail (ISS-037) - GDPR compliance, delivery tracking
app.include_router(email_audit.router, tags=["Email Audit"])

# POS System router
app.include_router(pos_transactions.router, tags=["POS System"])
app.include_router(receipts.router, tags=["POS Receipts"])  # UNI-1845
app.include_router(bank_feeds.router, tags=["Bank Feeds"])
app.include_router(reconciliation.router, tags=["Reconciliation"])
app.include_router(reconciliation_dashboard.router, tags=["Reconciliation Dashboard"])
app.include_router(eod_reconciliation.router, tags=["POS EOD Reconciliation"])  # UNI-1849

# Monitoring routers (system alerts, business metrics, performance)
try:
    from src.api.routes.monitoring import alerts, business_metrics, infrastructure, performance
    app.include_router(alerts.router)
    app.include_router(business_metrics.router)
    app.include_router(performance.router)
    app.include_router(infrastructure.router)
except (ImportError, AttributeError):
    pass  # Monitoring routes not available

# Workshop Management System
try:
    from src.api.routes.workshop import bookings as ws_bookings
    from src.api.routes.workshop import dashboard as ws_dashboard
    from src.api.routes.workshop import equipment as ws_equipment
    from src.api.routes.workshop import job_cards as ws_job_cards
    from src.api.routes.workshop import reminders as ws_reminders
    from src.api.routes.workshop import templates as ws_templates
    app.include_router(ws_equipment.router, tags=["Workshop"])
    app.include_router(ws_templates.router, tags=["Workshop"])
    app.include_router(ws_bookings.router, tags=["Workshop"])
    app.include_router(ws_reminders.router, tags=["Workshop"])
    app.include_router(ws_dashboard.router, tags=["Workshop"])
    app.include_router(ws_job_cards.router, tags=["Workshop"])
except (ImportError, AttributeError) as e:
    logger.warning("Workshop routes not available", error=str(e))
    pass

# Mobile Photo-to-Order
try:
    from src.api.routes.mobile import guest_orders as mobile_guest_orders
    app.include_router(mobile_guest_orders.router, tags=["Mobile Orders"])
except (ImportError, AttributeError) as e:
    logger.warning("Mobile order routes not available", error=str(e))

# Shadow / Observation Mode (1-month parallel observation alongside client's live system)
try:
    import src.db.shadow_session_models as _shadow_session_models  # noqa: F401 - registers tables
    from src.api.routes import shadow_analytics, shadow_mode
    app.include_router(shadow_mode.router, tags=["Shadow Mode"])
    app.include_router(shadow_analytics.router, tags=["Shadow Analytics"])
except (ImportError, AttributeError) as e:
    logger.warning("Shadow mode routes not available", error=str(e))

# Real-Time Infrastructure - SSE Streams (Phase 4)
from src.api.routes import dashboard_stream, inventory_stream

app.include_router(inventory_stream.router, tags=["Real-Time Inventory"])
app.include_router(dashboard_stream.router, tags=["Real-Time Dashboard"])

# PRD Generation router (✅ IMPLEMENTED)
app.include_router(prd.router, tags=["PRD Generation"])

# ASD Essential Eight compliance controls (UNI-1857)
try:
    from src.api.routes import security_controls
    app.include_router(security_controls.router, tags=["Security Controls"])
except ImportError:
    pass

# NDB Notifiable Data Breaches incident workflow (UNI-1858)
try:
    from src.api.routes import ndb_incident
    app.include_router(ndb_incident.router, tags=["NDB Incident Response"])
except ImportError:
    pass

# UNI-1844: AU Utils (state codes reference list)
try:
    from src.api.routes import utils as utils_routes
    app.include_router(utils_routes.router, tags=["Utils"])
except (ImportError, AttributeError):
    pass

# UNI-1848: RCTI (Recipient-Created Tax Invoice) support
try:
    from src.api.routes import rcti
    app.include_router(rcti.router, tags=["RCTI"])
except (ImportError, AttributeError):
    pass

# UNI-1846: AU Customs Import Documentation
try:
    from src.api.routes import customs_docs
    app.include_router(customs_docs.router, tags=["Customs Docs"])
except (ImportError, AttributeError):
    pass

# UNI-1862: Privacy Act APP 12 (access/correction/deletion requests + data export)
try:
    from src.api.routes import privacy_access
    app.include_router(privacy_access.router, tags=["Privacy / APP 12"])
except (ImportError, AttributeError):
    pass

# UNI-1860: Xero Payroll STP Phase 2
try:
    from src.api.routes import payroll
    app.include_router(payroll.router, tags=["Payroll / STP Phase 2"])
except (ImportError, AttributeError):
    pass


@app.get("/")
async def root() -> dict[str, str]:
    """Root endpoint."""
    return {"message": "CCW Equipment Supplier ERP API", "version": "1.0.0"}
