"""Specialized agent API endpoints."""
from __future__ import annotations

from typing import Any
from uuid import UUID

import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from src.ai.agents.specialized import (
    PricingAgent,
    ProcurementAgent,
    TaskExecutorAgent,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/specialized", tags=["Specialized Agents"])


# Request/Response Models
class PricingRecommendationRequest(BaseModel):
    """Request for pricing recommendation."""

    product_id: str = Field(description="Product UUID")
    target_margin: float = Field(description="Target margin percentage", ge=0, le=100)
    context: dict[str, Any] = Field(
        default_factory=dict,
        description="Additional context",
    )


class PricingRecommendationResponse(BaseModel):
    """Response from pricing recommendation."""

    product: dict[str, Any]
    recommendation: dict[str, Any]
    validation: dict[str, Any] | None = None
    status: str


class ProcurementAnalysisRequest(BaseModel):
    """Request for procurement/inventory analysis."""

    category: str | None = Field(
        default=None,
        description="Optional product category filter",
    )
    context: dict[str, Any] = Field(
        default_factory=dict,
        description="Additional context",
    )


class ProcurementAnalysisResponse(BaseModel):
    """Response from procurement analysis."""

    summary: dict[str, Any]
    priority_actions: list[dict[str, Any]]
    insights: list[str]
    status: str


class ActionValidationRequest(BaseModel):
    """Request to validate an action without executing."""

    action_type: str = Field(description="Type of action (e.g., update_product, create_order)")
    action_params: dict[str, Any] = Field(description="Action parameters")


class ActionValidationResponse(BaseModel):
    """Response from action validation."""

    is_valid: bool
    validation_errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class ActionExecutionRequest(BaseModel):
    """Request to execute an action."""

    action_type: str = Field(description="Type of action")
    action_params: dict[str, Any] = Field(description="Action parameters")
    confirmation_token: str | None = Field(
        default=None,
        description="Confirmation token for verified execution",
    )


class ActionExecutionResponse(BaseModel):
    """Response from action execution."""

    status: str
    message: str
    confirmation_token: str | None = None
    confirmation_instructions: str | None = None
    execution_result: dict[str, Any] | None = None
    validation_errors: list[str] = Field(default_factory=list)


# Singleton agent instances
_pricing_agent: PricingAgent | None = None
_procurement_agent: ProcurementAgent | None = None
_executor_agent: TaskExecutorAgent | None = None


def get_pricing_agent() -> PricingAgent:
    """Get or create pricing agent singleton."""
    global _pricing_agent
    if _pricing_agent is None:
        _pricing_agent = PricingAgent()
        logger.info("Pricing agent initialized for API")
    return _pricing_agent


def get_procurement_agent() -> ProcurementAgent:
    """Get or create procurement agent singleton."""
    global _procurement_agent
    if _procurement_agent is None:
        _procurement_agent = ProcurementAgent()
        logger.info("Procurement agent initialized for API")
    return _procurement_agent


def get_executor_agent() -> TaskExecutorAgent:
    """Get or create executor agent singleton."""
    global _executor_agent
    if _executor_agent is None:
        _executor_agent = TaskExecutorAgent()
        logger.info("Task executor agent initialized for API")
    return _executor_agent


@router.post("/pricing/recommend", response_model=PricingRecommendationResponse)
async def recommend_pricing(
    request: PricingRecommendationRequest,
) -> PricingRecommendationResponse:
    """
    Get pricing recommendation for a product.

    Args:
        request: Pricing recommendation request

    Returns:
        PricingRecommendationResponse: Pricing analysis and recommendation

    Raises:
        HTTPException: If product not found or analysis fails
    """
    logger.info(
        "Pricing recommendation requested",
        product_id=request.product_id,
        target_margin=request.target_margin,
    )

    try:
        # Validate product_id format
        try:
            UUID(request.product_id)
        except ValueError as e:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid product_id format: {request.product_id}",
            ) from e

        # Execute pricing agent
        agent = get_pricing_agent()
        result = await agent.execute(
            task=f"Recommend pricing for product {request.product_id}",
            context={
                "request_type": "recommend",
                "product_id": request.product_id,
                "target_margin": request.target_margin,
                **request.context,
            },
        )

        # Check for errors
        if result.get("error"):
            error_msg = result["error"]
            if "not found" in error_msg.lower():
                raise HTTPException(status_code=404, detail=error_msg)
            raise HTTPException(status_code=500, detail=error_msg)

        logger.info(
            "Pricing recommendation completed",
            product_id=request.product_id,
            status=result.get("status"),
        )

        return PricingRecommendationResponse(
            product=result.get("product", {}),
            recommendation=result.get("recommendation", {}),
            validation=result.get("validation"),
            status=result.get("status", "completed"),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Pricing recommendation failed",
            product_id=request.product_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=500,
            detail=f"Pricing recommendation failed: {str(e)}",
        ) from e


@router.post("/procurement/analyze", response_model=ProcurementAnalysisResponse)
async def analyze_procurement(
    request: ProcurementAnalysisRequest,
) -> ProcurementAnalysisResponse:
    """
    Analyze inventory and procurement needs.

    Args:
        request: Procurement analysis request

    Returns:
        ProcurementAnalysisResponse: Inventory analysis and recommendations

    Raises:
        HTTPException: If analysis fails
    """
    logger.info(
        "Procurement analysis requested",
        category=request.category,
    )

    try:
        # Execute procurement agent
        agent = get_procurement_agent()
        result = await agent.execute(
            task=f"Analyze inventory{f' for category {request.category}' if request.category else ''}",  # noqa: E501
            context={
                "request_type": "analyze_inventory",
                "category": request.category,
                **request.context,
            },
        )

        # Check for errors
        if result.get("error"):
            raise HTTPException(status_code=500, detail=result["error"])

        logger.info(
            "Procurement analysis completed",
            status=result.get("status"),
            products_analyzed=result.get("summary", {}).get("total_products_analyzed", 0),
        )

        return ProcurementAnalysisResponse(
            summary=result.get("summary", {}),
            priority_actions=result.get("priority_actions", []),
            insights=result.get("insights", []),
            status=result.get("status", "completed"),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Procurement analysis failed",
            category=request.category,
            error=str(e),
        )
        raise HTTPException(
            status_code=500,
            detail=f"Procurement analysis failed: {str(e)}",
        ) from e


@router.post("/executor/validate", response_model=ActionValidationResponse)
async def validate_action(
    request: ActionValidationRequest,
) -> ActionValidationResponse:
    """
    Validate an action without executing it.

    Args:
        request: Action validation request

    Returns:
        ActionValidationResponse: Validation results with errors and warnings

    Raises:
        HTTPException: If validation check fails
    """
    logger.info(
        "Action validation requested",
        action_type=request.action_type,
    )

    try:
        # Execute validation through executor agent
        agent = get_executor_agent()
        result = await agent.execute(
            task=f"Validate {request.action_type} action",
            context={
                "action_type": request.action_type,
                "action_params": request.action_params,
                "validate_only": True,
            },
        )

        validation_errors = result.get("validation_errors", [])
        warnings = result.get("warnings", [])

        is_valid = len(validation_errors) == 0

        logger.info(
            "Action validation completed",
            action_type=request.action_type,
            is_valid=is_valid,
            error_count=len(validation_errors),
        )

        return ActionValidationResponse(
            is_valid=is_valid,
            validation_errors=validation_errors,
            warnings=warnings,
        )

    except Exception as e:
        logger.error(
            "Action validation failed",
            action_type=request.action_type,
            error=str(e),
        )
        raise HTTPException(
            status_code=500,
            detail=f"Action validation failed: {str(e)}",
        ) from e


@router.post("/executor/execute", response_model=ActionExecutionResponse)
async def execute_action(
    request: ActionExecutionRequest,
) -> ActionExecutionResponse:
    """
    Execute an action with confirmation token.

    For write operations, a confirmation token is required.
    The workflow is:
    1. Call without token → Returns token and instructions
    2. User approves and provides token
    3. Call with token → Executes action

    Args:
        request: Action execution request

    Returns:
        ActionExecutionResponse: Execution result or confirmation request

    Raises:
        HTTPException: If execution fails
    """
    logger.info(
        "Action execution requested",
        action_type=request.action_type,
        has_token=request.confirmation_token is not None,
    )

    try:
        # Execute through executor agent
        agent = get_executor_agent()
        result = await agent.execute(
            task=f"Execute {request.action_type} action",
            context={
                "action_type": request.action_type,
                "action_params": request.action_params,
                "confirmation_token": request.confirmation_token,
            },
        )

        status = result.get("status", "completed")
        message = result.get("message", "")

        # Handle different statuses
        response_data = {
            "status": status,
            "message": message,
        }

        if status == "pending_confirmation":
            response_data["confirmation_token"] = result.get("confirmation_token")
            response_data["confirmation_instructions"] = result.get("confirmation_instructions")

        elif status == "completed":
            response_data["execution_result"] = result.get("execution_result", {})

        elif status == "failed":
            response_data["validation_errors"] = result.get("validation_errors", [])

        logger.info(
            "Action execution result",
            action_type=request.action_type,
            status=status,
        )

        return ActionExecutionResponse(**response_data)

    except Exception as e:
        logger.error(
            "Action execution failed",
            action_type=request.action_type,
            error=str(e),
        )
        raise HTTPException(
            status_code=500,
            detail=f"Action execution failed: {str(e)}",
        ) from e
