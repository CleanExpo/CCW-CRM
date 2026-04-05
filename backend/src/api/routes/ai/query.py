"""Natural Language ERP Query API endpoints.

POST /api/ai/query          — execute an NL query (JSON response)
GET  /api/ai/query/stream   — SSE streaming version
GET  /api/ai/query/examples — example queries for the UI
"""

from __future__ import annotations

from typing import Annotated, Any

import structlog
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.ai.agents.specialized.query_agent import QueryAgent
from src.config.database import get_async_db

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/ai/query", tags=["NL ERP Query"])

# Singleton
_agent: QueryAgent | None = None


def _get_agent() -> QueryAgent:
    global _agent
    if _agent is None:
        _agent = QueryAgent()
    return _agent


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class QueryRequest(BaseModel):
    query: str = Field(..., min_length=3, max_length=500, description="Natural language question")


class QueryResult(BaseModel):
    query: str
    sql: str | None = None
    results: list[dict[str, Any]] = Field(default_factory=list)
    answer: str
    confidence: float
    row_count: int


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("", response_model=QueryResult)
async def nl_query(
    payload: QueryRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> QueryResult:
    """
    Convert a natural language question into SQL, execute it, and return
    a plain-English answer with the underlying data.

    Examples:
      - "How many truckmounts do we have in stock?"
      - "Which customers haven't ordered in 90 days?"
      - "What are our highest margin products?"
      - "Show me overdue invoices"

    In demo mode (no ANTHROPIC_API_KEY), returns realistic canned answers.
    """
    agent = _get_agent()
    result = await agent.execute(payload.query, context={"db": db})
    logger.info("NL query executed", query=payload.query[:60], rows=result.get("row_count"))
    return QueryResult(**result)


@router.get("/stream")
async def nl_query_stream(
    q: str = Query(..., min_length=3, max_length=500, description="Natural language question"),
    db: Annotated[AsyncSession, Depends(get_async_db)] = None,  # type: ignore[assignment]
) -> StreamingResponse:
    """
    SSE streaming version of the NL query endpoint.

    Streams the answer token-by-token, then sends a final 'complete' event
    with the full SQL + results.
    """
    agent = _get_agent()

    async def event_stream():
        async for chunk in agent.stream(q, context={"db": db}):
            yield chunk

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/examples")
async def get_query_examples() -> dict[str, Any]:
    """Return example NL queries for the query UI."""
    return {
        "examples": [
            {
                "category": "Inventory",
                "queries": [
                    "How many truckmounts do we have in stock?",
                    "Which products are below reorder point?",
                    "Show me our top 10 products by stock value",
                ],
            },
            {
                "category": "Customers",
                "queries": [
                    "Which customers haven't ordered in 90 days?",
                    "Show me our top 10 customers by total spend",
                    "List customers with overdue payments",
                ],
            },
            {
                "category": "Financials",
                "queries": [
                    "What are our highest margin products?",
                    "Show me overdue invoices",
                    "What was our total revenue this month?",
                ],
            },
            {
                "category": "Orders",
                "queries": [
                    "How many orders are in processing status?",
                    "Show me orders over $5,000 this quarter",
                    "Which orders are pending dispatch?",
                ],
            },
        ]
    }
