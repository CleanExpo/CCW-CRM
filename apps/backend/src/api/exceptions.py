"""Global exception handlers for the FastAPI application.

Ensures all errors return JSON responses, preventing HTML error pages.
"""
import traceback
from typing import Any

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import DatabaseError, IntegrityError, OperationalError
from starlette.exceptions import HTTPException as StarletteHTTPException

from src.config.settings import get_settings
from src.db.schemas import ErrorDetail, ErrorResponse

settings = get_settings()


async def http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    """Handle HTTP exceptions (404, 401, 403, etc.)."""
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            error=exc.detail or "HTTP error occurred",
            detail=str(exc.detail) if exc.detail else None,
            status_code=exc.status_code,
        ).model_dump(),
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Handle Pydantic validation errors with field-level details."""
    errors: list[ErrorDetail] = []

    for error in exc.errors():
        field_path = ".".join(str(loc) for loc in error["loc"] if loc != "body")
        errors.append(
            ErrorDetail(
                field=field_path if field_path else None,
                message=error["msg"],
                type=error["type"],
            )
        )

    return JSONResponse(
        status_code=422,
        content=ErrorResponse(
            error="Validation error",
            detail="Request validation failed. Check the errors field for details.",
            status_code=422,
            errors=errors,
        ).model_dump(),
    )


async def integrity_error_handler(
    request: Request, exc: IntegrityError
) -> JSONResponse:
    """Handle database integrity errors (unique constraints, foreign keys, etc.)."""
    error_message = str(exc.orig) if hasattr(exc, "orig") else str(exc)

    # Extract user-friendly messages for common integrity violations
    if "unique constraint" in error_message.lower():
        user_message = "A record with this value already exists"
    elif "foreign key" in error_message.lower():
        user_message = "Referenced record does not exist"
    elif "not null" in error_message.lower():
        user_message = "Required field is missing"
    else:
        user_message = "Database integrity constraint violation"

    return JSONResponse(
        status_code=409,
        content=ErrorResponse(
            error=user_message,
            detail=error_message if settings.debug else None,
            status_code=409,
        ).model_dump(),
    )


async def operational_error_handler(
    request: Request, exc: OperationalError
) -> JSONResponse:
    """Handle database operational errors (connection issues, timeouts, etc.)."""
    error_message = str(exc.orig) if hasattr(exc, "orig") else str(exc)

    return JSONResponse(
        status_code=503,
        content=ErrorResponse(
            error="Database connection error",
            detail=error_message if settings.debug else "Service temporarily unavailable",
            status_code=503,
        ).model_dump(),
    )


async def database_error_handler(
    request: Request, exc: DatabaseError
) -> JSONResponse:
    """Handle generic database errors."""
    error_message = str(exc.orig) if hasattr(exc, "orig") else str(exc)

    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            error="Database error",
            detail=error_message if settings.debug else "An error occurred while processing your request",
            status_code=500,
        ).model_dump(),
    )


async def generic_exception_handler(
    request: Request, exc: Exception
) -> JSONResponse:
    """Catch-all handler: ensures NO exception ever returns HTML.

    This is the last line of defense - every unhandled exception goes through here.
    CRITICAL: This prevents the JSONDecodeError issue where HTML error pages
    were being returned instead of JSON.
    """
    # Log the full exception for debugging
    print(f"[UNHANDLED EXCEPTION] {type(exc).__name__}: {str(exc)}")
    print(f"[REQUEST] {request.method} {request.url.path}")
    if settings.debug:
        print(f"[TRACEBACK]\n{traceback.format_exc()}")

    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            error="Internal server error",
            detail=str(exc) if settings.debug else "An unexpected error occurred",
            status_code=500,
        ).model_dump(),
    )
