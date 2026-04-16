"""Structured logging configuration."""

import logging
import sys
from typing import Any

import structlog


def setup_logging(debug: bool = False, betterstack_token: str = "") -> None:
    """Configure structured logging for the application.

    Uses structlog with stdlib logging backend so log records flow through
    Python's logging system. This allows multiple handlers (stdout + BetterStack)
    without duplicating the structlog processor chain.
    """
    log_level = logging.DEBUG if debug else logging.INFO

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.dev.set_exc_info,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        wrapper_class=structlog.make_filtering_bound_logger(log_level),
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # Console handler — pretty in debug, JSON in production
    console_formatter = structlog.stdlib.ProcessorFormatter(
        processor=structlog.dev.ConsoleRenderer() if debug else structlog.processors.JSONRenderer(),
    )
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(console_formatter)

    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    # Remove any handlers added by basicConfig calls elsewhere before we add ours
    root_logger.handlers.clear()
    root_logger.addHandler(console_handler)

    # BetterStack handler — only wired when token is present
    if betterstack_token:
        try:
            from logtail import LogtailHandler

            bt_handler = LogtailHandler(source_token=betterstack_token)
            bt_handler.setLevel(log_level)
            root_logger.addHandler(bt_handler)
        except ImportError:
            root_logger.warning("logtail-python not installed; BetterStack drain skipped")


def get_logger(name: str) -> Any:
    """Get a structured logger instance."""
    return structlog.get_logger(name)
