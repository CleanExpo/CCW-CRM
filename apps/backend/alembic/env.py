import os
from logging.config import fileConfig

from dotenv import load_dotenv
from sqlalchemy import engine_from_config, pool

from alembic import context

# Load environment variables
load_dotenv()

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Override sqlalchemy.url with DATABASE_URL from environment
# Convert async driver (asyncpg) to sync driver (psycopg2) for Alembic migrations
database_url = os.getenv("DATABASE_URL")
if database_url:
    # Alembic runs synchronously, so we need to use psycopg2 instead of asyncpg
    sync_url = database_url.replace("postgresql+asyncpg://", "postgresql://")
    config.set_main_option("sqlalchemy.url", sync_url)

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
# Import models here when created (after env setup, so noqa: E402 is intentional)
# These side-effect imports register models with SQLAlchemy metadata for autogenerate
from src.db.demo_models import (  # noqa: E402,F401
    AgentExecution,
    AIGeneratedContent,
    BackgroundJob,
    ConversationHistory,
    Customer,
    JobStatus,
    Order,
    OrderActivity,
    OrderItem,
    OrderStatus,
    Organization,
    Product,
    ProductCategory,
    Quote,
    QuoteItem,
    QuoteStatus,
)
from src.db.inventory_models import (  # noqa: E402,F401
    CarrierConfiguration,
    InboundShipment,
    OutboundShipment,
    ProductAttribute,
    ProductBarcode,
    ProductStockByLocation,
    ProductVariant,
    PurchaseOrder,
    PurchaseOrderItem,
    ReorderRule,
    StockAdjustment,
    StockReservation,
    StockTake,
    StockTakeItem,
    StockTransfer,
    StoreLocation,
    Supplier,
)
from src.db.models import Base  # noqa: E402

target_metadata = Base.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
