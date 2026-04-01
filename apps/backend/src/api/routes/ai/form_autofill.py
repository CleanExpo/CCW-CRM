"""Form Auto-Fill API endpoints."""
from __future__ import annotations

from typing import Any

import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from src.ai.agents.specialized import FormAutoFillAgent

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/form-autofill", tags=["AI Form Auto-Fill"])


# Request/Response Models
class AutoFillRequest(BaseModel):
    """Request for form auto-fill suggestions."""

    form_type: str = Field(
        description="Type of form: order, quote, purchase_order, customer"
    )
    customer_id: str | None = Field(
        default=None,
        description="Customer UUID (for order/quote forms)"
    )
    supplier_id: str | None = Field(
        default=None,
        description="Supplier UUID (for purchase_order forms)"
    )
    email: str | None = Field(
        default=None,
        description="Email for duplicate detection (customer forms)"
    )
    name: str | None = Field(
        default=None,
        description="Name for duplicate detection (customer forms)"
    )
    phone: str | None = Field(
        default=None,
        description="Phone for duplicate detection (customer forms)"
    )
    limit: int = Field(
        default=10,
        ge=1,
        le=50,
        description="Maximum number of product suggestions"
    )


class AutoFillResponse(BaseModel):
    """Response from form auto-fill."""

    suggestions: dict[str, Any] = Field(
        description="Suggested values for form fields"
    )
    confidence: dict[str, float] = Field(
        default_factory=dict,
        description="Confidence scores (0-1) for each suggestion"
    )
    source: dict[str, str] = Field(
        default_factory=dict,
        description="Data source for each suggestion"
    )
    duplicates: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Potential duplicate customers (for customer forms)"
    )
    message: str | None = Field(
        default=None,
        description="Additional information message"
    )
    error: str | None = Field(
        default=None,
        description="Error message if request failed"
    )


# Singleton agent instance
_autofill_agent: FormAutoFillAgent | None = None


def get_autofill_agent() -> FormAutoFillAgent:
    """Get or create form auto-fill agent singleton."""
    global _autofill_agent
    if _autofill_agent is None:
        _autofill_agent = FormAutoFillAgent()
        logger.info("Form auto-fill agent initialized for API")
    return _autofill_agent


@router.post("", response_model=AutoFillResponse)
async def auto_fill_form(
    request: AutoFillRequest,
) -> AutoFillResponse:
    """
    Get form auto-fill suggestions based on context.

    For order/quote forms:
    - Requires customer_id
    - Returns: shipping address, payment method, product suggestions

    For purchase_order forms:
    - Requires supplier_id
    - Returns: delivery terms, expected delivery date

    For customer forms:
    - Requires email and/or name
    - Returns: potential duplicate customers

    Example Request (Order Form):
    ```json
    {
      "form_type": "order",
      "customer_id": "123e4567-e89b-12d3-a456-426614174000",
      "limit": 10
    }
    ```

    Example Response:
    ```json
    {
      "suggestions": {
        "shipping_address": {
          "address": "123 Main St",
          "city": "Sydney",
          "state": "NSW",
          "postal_code": "2000",
          "country": "Australia"
        },
        "products": [
          {
            "product_id": "uuid",
            "sku": "SKU-001",
            "name": "Product Name",
            "price": 99.99,
            "avg_quantity": 10
          }
        ]
      },
      "confidence": {
        "shipping_address": 0.95,
        "products": 0.85
      },
      "source": {
        "shipping_address": "customer_default",
        "products": "pattern_last_3_orders"
      }
    }
    ```
    """
    logger.info(
        "Form auto-fill requested",
        form_type=request.form_type,
        has_customer_id=request.customer_id is not None,
        has_supplier_id=request.supplier_id is not None,
    )

    try:
        # Build context from request
        context = {
            "form_type": request.form_type,
            "limit": request.limit,
        }

        if request.customer_id:
            context["customer_id"] = request.customer_id
        if request.supplier_id:
            context["supplier_id"] = request.supplier_id
        if request.email:
            context["email"] = request.email
        if request.name:
            context["name"] = request.name
        if request.phone:
            context["phone"] = request.phone

        # Execute agent
        agent = get_autofill_agent()
        result = await agent.execute(
            task=f"Auto-fill {request.form_type} form",
            context=context
        )

        # Check for errors
        if result.get("error"):
            error_msg = result["error"]
            if "not found" in error_msg.lower():
                raise HTTPException(status_code=404, detail=error_msg)
            if "invalid" in error_msg.lower():
                raise HTTPException(status_code=400, detail=error_msg)
            raise HTTPException(status_code=500, detail=error_msg)

        logger.info(
            "Form auto-fill completed",
            form_type=request.form_type,
            suggestions_count=len(result.get("suggestions", {})),
            duplicates_count=len(result.get("duplicates", [])),
        )

        return AutoFillResponse(
            suggestions=result.get("suggestions", {}),
            confidence=result.get("confidence", {}),
            source=result.get("source", {}),
            duplicates=result.get("duplicates", []),
            message=result.get("message"),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Form auto-fill failed",
            form_type=request.form_type,
            error=str(e),
        )
        raise HTTPException(
            status_code=500,
            detail=f"Form auto-fill failed: {str(e)}",
        ) from e
