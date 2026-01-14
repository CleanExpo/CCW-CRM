"""Task execution tools for performing actions with confirmation."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.demo_models import Customer, Order, Product, Quote
from src.utils import get_logger

from .base import BaseTool, ToolOutput

logger = get_logger(__name__)


class ValidateActionTool(BaseTool):
    """Validate an action before execution (dry run)."""

    name = "validate_action"
    description = "Validate an action without executing it to check for errors"

    def __init__(self):
        super().__init__(self.name, self.description)

    async def execute(
        self,
        action_type: str,
        action_params: dict,
        db: AsyncSession | None = None,
    ) -> ToolOutput:
        """Validate action parameters.

        Args:
            action_type: Type of action (create_order, update_product, etc.)
            action_params: Parameters for the action
            db: Database session

        Returns:
            ToolOutput with validation results
        """
        if not db:
            return ToolOutput(success=False, error="Database session required", data={})

        validation_errors = []
        warnings = []

        try:
            # Validate based on action type
            if action_type == "create_order":
                # Validate customer exists
                customer_id = action_params.get("customer_id")
                if not customer_id:
                    validation_errors.append("customer_id is required")
                else:
                    customer_result = await db.execute(
                        select(Customer).where(Customer.id == UUID(customer_id))
                    )
                    customer = customer_result.scalar_one_or_none()
                    if not customer:
                        validation_errors.append(f"Customer {customer_id} not found")

                # Validate products exist and are in stock
                items = action_params.get("items", [])
                if not items:
                    validation_errors.append("Order must have at least one item")

                for item in items:
                    product_id = item.get("product_id")
                    quantity = item.get("quantity", 0)

                    if not product_id:
                        validation_errors.append("product_id required for each item")
                        continue

                    product_result = await db.execute(
                        select(Product).where(Product.id == UUID(product_id))
                    )
                    product = product_result.scalar_one_or_none()

                    if not product:
                        validation_errors.append(f"Product {product_id} not found")
                    elif not product.is_active:
                        validation_errors.append(f"Product {product.sku} is inactive")
                    elif product.stock < quantity:
                        warnings.append(
                            f"Product {product.sku} has insufficient stock "
                            f"({product.stock} available, {quantity} requested)"
                        )

            elif action_type == "update_product":
                # Validate product exists
                product_id = action_params.get("product_id")
                if not product_id:
                    validation_errors.append("product_id is required")
                else:
                    product_result = await db.execute(
                        select(Product).where(Product.id == UUID(product_id))
                    )
                    product = product_result.scalar_one_or_none()
                    if not product:
                        validation_errors.append(f"Product {product_id} not found")

                # Validate update fields
                updates = action_params.get("updates", {})
                if not updates:
                    validation_errors.append("No update fields provided")

                # Validate numeric fields
                if "price" in updates and updates["price"] < 0:
                    validation_errors.append("Price cannot be negative")
                if "stock" in updates and updates["stock"] < 0:
                    validation_errors.append("Stock cannot be negative")

            elif action_type == "delete_order":
                # Validate order exists
                order_id = action_params.get("order_id")
                if not order_id:
                    validation_errors.append("order_id is required")
                else:
                    order_result = await db.execute(
                        select(Order).where(Order.id == UUID(order_id))
                    )
                    order = order_result.scalar_one_or_none()
                    if not order:
                        validation_errors.append(f"Order {order_id} not found")
                    elif order.status in ["shipped", "delivered"]:
                        validation_errors.append(
                            f"Cannot delete order with status '{order.status}'"
                        )

            elif action_type == "update_customer":
                # Validate customer exists
                customer_id = action_params.get("customer_id")
                if not customer_id:
                    validation_errors.append("customer_id is required")
                else:
                    customer_result = await db.execute(
                        select(Customer).where(Customer.id == UUID(customer_id))
                    )
                    customer = customer_result.scalar_one_or_none()
                    if not customer:
                        validation_errors.append(f"Customer {customer_id} not found")

                # Validate update fields
                updates = action_params.get("updates", {})
                if not updates:
                    validation_errors.append("No update fields provided")

            else:
                validation_errors.append(f"Unknown action type: {action_type}")

            # Return validation result
            validation_passed = len(validation_errors) == 0

            return ToolOutput(
                success=True,
                data={
                    "validation_passed": validation_passed,
                    "errors": validation_errors,
                    "warnings": warnings,
                    "action_type": action_type,
                    "requires_confirmation": True,  # All write actions require confirmation
                },
            )

        except Exception as e:
            logger.error("Action validation failed", error=str(e), action_type=action_type)
            return ToolOutput(success=False, error=str(e), data={})


class ExecuteActionTool(BaseTool):
    """Execute a validated action (with confirmation)."""

    name = "execute_action"
    description = "Execute an action after confirmation and validation"

    def __init__(self):
        super().__init__(self.name, self.description)

    async def execute(
        self,
        action_type: str,
        action_params: dict,
        confirmation_verified: bool = False,
        db: AsyncSession | None = None,
    ) -> ToolOutput:
        """Execute action.

        Args:
            action_type: Type of action
            action_params: Parameters for the action
            confirmation_verified: Whether user confirmation was verified
            db: Database session

        Returns:
            ToolOutput with execution results
        """
        if not db:
            return ToolOutput(success=False, error="Database session required", data={})

        if not confirmation_verified:
            return ToolOutput(
                success=False,
                error="Action requires user confirmation before execution",
                data={},
            )

        try:
            # Execute based on action type
            # Note: This is a simplified implementation
            # Real implementation would use proper service layer

            if action_type == "create_order":
                return ToolOutput(
                    success=True,
                    data={
                        "action": "create_order",
                        "status": "success",
                        "message": "Order creation would be executed here",
                        "note": "Full implementation requires order service integration",
                    },
                )

            elif action_type == "update_product":
                product_id = action_params.get("product_id")
                updates = action_params.get("updates", {})

                # Get product
                product_result = await db.execute(
                    select(Product).where(Product.id == UUID(product_id))
                )
                product = product_result.scalar_one_or_none()

                if not product:
                    return ToolOutput(
                        success=False,
                        error=f"Product {product_id} not found",
                        data={},
                    )

                # Apply updates
                old_values = {}
                for field, value in updates.items():
                    if hasattr(product, field):
                        old_values[field] = getattr(product, field)
                        setattr(product, field, value)

                await db.commit()

                return ToolOutput(
                    success=True,
                    data={
                        "action": "update_product",
                        "status": "success",
                        "product_id": str(product.id),
                        "sku": product.sku,
                        "updated_fields": list(updates.keys()),
                        "old_values": old_values,
                        "new_values": updates,
                    },
                )

            elif action_type == "delete_order":
                return ToolOutput(
                    success=True,
                    data={
                        "action": "delete_order",
                        "status": "success",
                        "message": "Order deletion would be executed here",
                        "note": "Full implementation requires order service integration",
                    },
                )

            elif action_type == "update_customer":
                customer_id = action_params.get("customer_id")
                updates = action_params.get("updates", {})

                # Get customer
                customer_result = await db.execute(
                    select(Customer).where(Customer.id == UUID(customer_id))
                )
                customer = customer_result.scalar_one_or_none()

                if not customer:
                    return ToolOutput(
                        success=False,
                        error=f"Customer {customer_id} not found",
                        data={},
                    )

                # Apply updates
                old_values = {}
                for field, value in updates.items():
                    if hasattr(customer, field):
                        old_values[field] = getattr(customer, field)
                        setattr(customer, field, value)

                await db.commit()

                return ToolOutput(
                    success=True,
                    data={
                        "action": "update_customer",
                        "status": "success",
                        "customer_id": str(customer.id),
                        "customer_number": customer.customer_number,
                        "updated_fields": list(updates.keys()),
                        "old_values": old_values,
                        "new_values": updates,
                    },
                )

            else:
                return ToolOutput(
                    success=False,
                    error=f"Unknown action type: {action_type}",
                    data={},
                )

        except Exception as e:
            logger.error("Action execution failed", error=str(e), action_type=action_type)
            return ToolOutput(success=False, error=str(e), data={})
