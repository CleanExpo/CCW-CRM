"""Request ID middleware for distributed tracing."""

import uuid

import structlog
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = structlog.get_logger(__name__)


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Middleware that generates/propagates a unique request ID for every request.

    - Accepts an incoming ``X-Request-ID`` header from the client (for end-to-end
      correlation) or generates a new UUID4 if none is provided.
    - Stores the ID on ``request.state.request_id`` so downstream handlers and
      other middleware can access it.
    - Binds the ID into the structlog contextvars so **all** log lines emitted
      during the request automatically include ``request_id``.
    - Adds the ID to the response ``X-Request-ID`` header for client correlation.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        # Accept client-provided request ID or generate a new one
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())

        # Store on request state for downstream access
        request.state.request_id = request_id

        # Bind to structlog context so every log line includes request_id
        structlog.contextvars.bind_contextvars(request_id=request_id)

        try:
            response = await call_next(request)
        finally:
            # Always clear contextvars to prevent leaking between requests
            structlog.contextvars.unbind_contextvars("request_id")

        # Echo request ID back in response headers
        response.headers["X-Request-ID"] = request_id

        return response
