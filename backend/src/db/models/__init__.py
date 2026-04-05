"""Database models package.

Note: This package contains additional models that extend the base ERP system.
Models are imported directly from their files, not from this __init__.py to avoid circular imports.
"""

# Re-export Base and core models from models_base for convenience
from src.db.models_base import Base, User

# PRD models can be imported as: from src.db.models.prd import PRD, AgentRun, APIUsage
# Do not import them here to avoid circular import issues

__all__ = ["Base", "User"]
