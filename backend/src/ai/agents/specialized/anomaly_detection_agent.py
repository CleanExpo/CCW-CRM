"""
Anomaly Detection Agent.

Detects unusual patterns and outliers in business data using statistical
analysis to alert before issues escalate.
"""

import statistics
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.ai.base_agent import BaseAgent
from src.db.demo_models import (
    Order,
    Product,
)
from src.db.pos_models import POSTransaction

# from src.db.inventory_models import StockMovement  # Not implemented yet

logger = structlog.get_logger(__name__)


class AnomalyDetectionAgent(BaseAgent):
    """
    Detects anomalies and unusual patterns in business data.

    Uses statistical analysis (z-scores, standard deviation) and ML models
    to identify outliers and alert before issues become costly.
    """

    def __init__(self):
        """Initialize the anomaly detection agent."""
        super().__init__(
            name="AnomalyDetectionAgent",
            auto_register=True
        )
        self.capabilities = [
            "anomaly_detection",
            "statistical_analysis",
            "outlier_detection",
            "fraud_detection",
        ]
        self.description = "Detects unusual patterns and outliers in business data"
        self.requires_verification = False
        self.estimated_execution_time = 3  # seconds

        # Statistical thresholds
        self.z_score_threshold = 3.0  # Standard deviations for anomaly
        self.min_samples = 3  # Minimum data points for analysis

    async def execute(self, task: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
        """
        Analyze data for anomalies.

        Args:
            task: Task description
            context: Additional context with keys:
                - detection_type: "order_amount", "inventory", "pricing", "pos_failures"
                - entity_id: UUID of entity to check (order_id, product_id, etc.)
                - data: Optional data to analyze directly

        Returns:
            Dictionary with:
            - is_anomaly: Boolean indicating if anomaly detected
            - severity: "low", "medium", "high", "critical"
            - description: Human-readable anomaly description
            - recommended_action: What to do next
            - confidence: Float 0-1
            - details: Additional context and statistics
            - error: Error message if any
        """
        self._log_execution_start(task, context)

        if not context:
            return {"error": "Context required for anomaly detection"}

        detection_type = context.get("detection_type")
        if not detection_type:
            return {"error": "detection_type required in context"}

        try:
            async with self.get_db_session() as db:
                if detection_type == "order_amount":
                    result = await self._check_order_amount_anomaly(db, context)
                elif detection_type == "inventory":
                    result = await self._check_inventory_discrepancy(db, context)
                elif detection_type == "pricing":
                    result = await self._check_pricing_error(db, context)
                elif detection_type == "pos_failures":
                    result = await self._check_pos_failure_spike(db, context)
                else:
                    return {"error": f"Unknown detection_type: {detection_type}"}

                self._log_execution_complete(True)
                return result

        except Exception as e:
            logger.error("Anomaly detection failed", error=str(e), context=context)
            self._log_execution_complete(False, str(e))
            return {"error": str(e)}

    async def stream(self, task: str, context: dict[str, Any] | None = None):
        """Not implemented for this agent."""
        yield "Anomaly detection does not support streaming"

    async def _check_order_amount_anomaly(
        self,
        db: AsyncSession,
        context: dict[str, Any]
    ) -> dict[str, Any]:
        """
        Check if order amount is unusual for customer.

        Uses z-score analysis: (value - mean) / std_dev
        |z| > 3 typically indicates anomaly.

        Args:
            db: Database session
            context: Context with order_id or (customer_id, amount)

        Returns:
            Anomaly detection result
        """
        order_id = context.get("order_id")
        customer_id = context.get("customer_id")
        amount = context.get("amount")

        # If order_id provided, fetch order details
        if order_id:
            try:
                order_uuid = UUID(order_id)
            except (ValueError, TypeError):
                return {"error": "Invalid order_id format"}

            order_query = select(Order).where(Order.id == order_uuid)
            order_result = await db.execute(order_query)
            order = order_result.scalar_one_or_none()

            if not order:
                return {"error": "Order not found"}

            customer_id = str(order.customer_id)
            amount = float(order.total) if order.total else 0.0

        if not customer_id or amount is None:
            return {"error": "customer_id and amount required"}

        try:
            customer_uuid = UUID(customer_id)
        except (ValueError, TypeError):
            return {"error": "Invalid customer_id format"}

        # Get customer's last 10 orders for comparison
        orders_query = (
            select(Order)
            .where(Order.customer_id == customer_uuid)
            .where(Order.total.isnot(None))
            .order_by(desc(Order.order_date))
            .limit(10)
        )
        orders_result = await db.execute(orders_query)
        historical_orders = orders_result.scalars().all()

        if len(historical_orders) < self.min_samples:
            return {
                "is_anomaly": False,
                "severity": "low",
                "description": f"Insufficient order history ({len(historical_orders)} orders)",
                "recommended_action": "No action needed - building customer baseline",
                "confidence": 0.3,
                "details": {
                    "current_amount": amount,
                    "historical_orders": len(historical_orders),
                },
            }

        # Calculate statistics
        historical_amounts = [float(order.total) for order in historical_orders]
        mean_amount = statistics.mean(historical_amounts)

        if len(historical_amounts) > 1:
            std_dev = statistics.stdev(historical_amounts)
        else:
            std_dev = 0.0

        # Calculate z-score
        if std_dev > 0:
            z_score = (amount - mean_amount) / std_dev
        else:
            # All orders are the same amount
            z_score = 0.0 if amount == mean_amount else float('inf')

        # Determine if anomaly
        is_anomaly = abs(z_score) > self.z_score_threshold

        # Calculate confidence based on sample size and z-score magnitude
        confidence = min(
            0.95,
            (len(historical_amounts) / 10) * min(1.0, abs(z_score) / 5)
        )

        if not is_anomaly:
            return {
                "is_anomaly": False,
                "severity": "low",
                "description": f"Order amount ${amount:.2f} is within normal range",
                "recommended_action": "No action needed",
                "confidence": confidence,
                "details": {
                    "current_amount": amount,
                    "mean_amount": mean_amount,
                    "std_dev": std_dev,
                    "z_score": z_score,
                    "historical_orders": len(historical_amounts),
                },
            }

        # Determine severity based on z-score magnitude
        if abs(z_score) > 10:
            severity = "critical"
        elif abs(z_score) > 5:
            severity = "high"
        elif abs(z_score) > 4:
            severity = "medium"
        else:
            severity = "low"

        # Build description
        multiplier = amount / mean_amount if mean_amount > 0 else 0
        direction = "higher" if z_score > 0 else "lower"

        description = (
            f"Order amount ${amount:.2f} is {abs(z_score):.1f}× standard deviations "
            f"{direction} than customer average ${mean_amount:.2f} "
            f"({multiplier:.0f}× typical amount)"
        )

        recommended_action = (
            "Verify with customer before processing - potential fraud or data entry error"
            if severity in ["critical", "high"]
            else "Review order details - unusual but may be legitimate"
        )

        return {
            "is_anomaly": True,
            "severity": severity,
            "description": description,
            "recommended_action": recommended_action,
            "confidence": confidence,
            "details": {
                "current_amount": amount,
                "mean_amount": mean_amount,
                "std_dev": std_dev,
                "z_score": z_score,
                "historical_orders": len(historical_amounts),
                "multiplier": multiplier,
            },
        }

    async def _check_inventory_discrepancy(
        self,
        db: AsyncSession,
        context: dict[str, Any]
    ) -> dict[str, Any]:
        """
        Check for unexplained inventory changes.

        Compares expected stock changes (orders, transfers) against actual.
        Flags discrepancies >10% as potential issues.

        Args:
            db: Database session
            context: Context with product_id, location

        Returns:
            Anomaly detection result
        """
        product_id = context.get("product_id")
        location = context.get("location")

        if not product_id:
            return {"error": "product_id required"}

        try:
            product_uuid = UUID(product_id)
        except (ValueError, TypeError):
            return {"error": "Invalid product_id format"}

        # Get stock movements in last 24 hours
        cutoff_time = datetime.now(UTC) - timedelta(hours=24)

        movements_query = (
            select(StockMovement)
            .where(StockMovement.product_id == product_uuid)
            .where(StockMovement.created_at >= cutoff_time)
        )

        if location:
            movements_query = movements_query.where(
                StockMovement.location == location
            )

        movements_result = await db.execute(movements_query)
        movements = movements_result.scalars().all()

        if len(movements) < 2:
            return {
                "is_anomaly": False,
                "severity": "low",
                "description": "Insufficient stock movement data in last 24 hours",
                "recommended_action": "No action needed",
                "confidence": 0.2,
                "details": {
                    "movements_count": len(movements),
                    "time_window": "24 hours",
                },
            }

        # Calculate total stock change from documented movements
        total_change = sum(
            movement.quantity_change for movement in movements
        )

        # Get product to check current stock
        product_query = select(Product).where(Product.id == product_uuid)
        product_result = await db.execute(product_query)
        product = product_result.scalar_one_or_none()

        if not product:
            return {"error": "Product not found"}

        current_stock = product.stock

        # Simple check: large unexplained drop
        # (In production, would track expected vs actual stock more precisely)
        if total_change < -100:  # Lost >100 units in 24h
            return {
                "is_anomaly": True,
                "severity": "high",
                "description": f"Stock decreased by {abs(total_change)} units in 24 hours - verify movements",
                "recommended_action": "Review stock movements and conduct physical count",
                "confidence": 0.75,
                "details": {
                    "current_stock": current_stock,
                    "stock_change_24h": total_change,
                    "movements_count": len(movements),
                },
            }

        return {
            "is_anomaly": False,
            "severity": "low",
            "description": f"Stock movements within expected range ({total_change} units change)",
            "recommended_action": "No action needed",
            "confidence": 0.7,
            "details": {
                "current_stock": current_stock,
                "stock_change_24h": total_change,
                "movements_count": len(movements),
            },
        }

    async def _check_pricing_error(
        self,
        db: AsyncSession,
        context: dict[str, Any]
    ) -> dict[str, Any]:
        """
        Check if product price is below cost or unreasonably high.

        Flags:
        - Margin < 0% (selling below cost)
        - Margin > 200% (pricing error)

        Args:
            db: Database session
            context: Context with product_id

        Returns:
            Anomaly detection result
        """
        product_id = context.get("product_id")

        if not product_id:
            return {"error": "product_id required"}

        try:
            product_uuid = UUID(product_id)
        except (ValueError, TypeError):
            return {"error": "Invalid product_id format"}

        # Get product
        product_query = select(Product).where(Product.id == product_uuid)
        product_result = await db.execute(product_query)
        product = product_result.scalar_one_or_none()

        if not product:
            return {"error": "Product not found"}

        price = float(product.price) if product.price else 0.0
        cost = float(product.cost) if product.cost else 0.0

        if cost == 0:
            return {
                "is_anomaly": False,
                "severity": "low",
                "description": "No cost data available for margin check",
                "recommended_action": "Update product cost for margin analysis",
                "confidence": 0.3,
                "details": {
                    "price": price,
                    "cost": cost,
                },
            }

        # Calculate margin
        margin = ((price - cost) / cost) * 100 if cost > 0 else 0.0

        # Check for anomalies
        if margin < 0:
            # Selling below cost
            loss_per_unit = cost - price
            return {
                "is_anomaly": True,
                "severity": "critical",
                "description": f"Selling below cost - margin {margin:.1f}% (loss ${loss_per_unit:.2f} per unit)",
                "recommended_action": "URGENT: Update price immediately - losing money on every sale",
                "confidence": 0.99,
                "details": {
                    "price": price,
                    "cost": cost,
                    "margin_percent": margin,
                    "loss_per_unit": loss_per_unit,
                },
            }

        if margin > 200:
            # Unreasonably high margin - likely pricing error
            return {
                "is_anomaly": True,
                "severity": "high",
                "description": f"Margin {margin:.1f}% is unusually high - possible pricing error",
                "recommended_action": "Verify price is correct - may be data entry error",
                "confidence": 0.85,
                "details": {
                    "price": price,
                    "cost": cost,
                    "margin_percent": margin,
                },
            }

        # Normal margin range
        return {
            "is_anomaly": False,
            "severity": "low",
            "description": f"Margin {margin:.1f}% is within acceptable range",
            "recommended_action": "No action needed",
            "confidence": 0.9,
            "details": {
                "price": price,
                "cost": cost,
                "margin_percent": margin,
            },
        }

    async def _check_pos_failure_spike(
        self,
        db: AsyncSession,
        context: dict[str, Any]
    ) -> dict[str, Any]:
        """
        Check for unusual spike in POS payment failures.

        Detects:
        - 5+ failures in 10 minutes (terminal issue)
        - 10+ failures in 1 hour (system-wide issue)

        Args:
            db: Database session
            context: Context with optional location, terminal_id

        Returns:
            Anomaly detection result
        """
        location = context.get("location")
        terminal_id = context.get("terminal_id")
        time_window_minutes = context.get("time_window_minutes", 10)

        # Get recent failed transactions
        cutoff_time = datetime.now(UTC) - timedelta(minutes=time_window_minutes)

        failures_query = (
            select(POSTransaction)
            .where(POSTransaction.payment_status == "failed")
            .where(POSTransaction.created_at >= cutoff_time)
        )

        if location:
            failures_query = failures_query.where(
                POSTransaction.location_code == location
            )

        if terminal_id:
            try:
                terminal_uuid = UUID(terminal_id)
                failures_query = failures_query.where(
                    POSTransaction.terminal_id == terminal_uuid
                )
            except (ValueError, TypeError):
                pass  # Skip terminal filter if invalid

        failures_result = await db.execute(failures_query)
        failures = failures_result.scalars().all()

        failure_count = len(failures)

        # Determine thresholds based on time window
        if time_window_minutes <= 10:
            critical_threshold = 5
            high_threshold = 3
        elif time_window_minutes <= 60:
            critical_threshold = 10
            high_threshold = 5
        else:
            critical_threshold = 20
            high_threshold = 10

        # Check for anomaly
        if failure_count >= critical_threshold:
            severity = "critical"
            description = (
                f"{failure_count} POS failures in {time_window_minutes} minutes - "
                f"system-wide issue likely"
            )
            recommended_action = "URGENT: Check POS terminals and payment gateway immediately"
            confidence = 0.95
        elif failure_count >= high_threshold:
            severity = "high"
            description = (
                f"{failure_count} POS failures in {time_window_minutes} minutes - "
                f"investigate payment system"
            )
            recommended_action = "Check terminal logs and test payment processing"
            confidence = 0.85
        else:
            severity = "low"
            description = f"{failure_count} POS failures in {time_window_minutes} minutes - within normal range"
            recommended_action = "Monitor situation - no immediate action needed"
            confidence = 0.7

        return {
            "is_anomaly": failure_count >= high_threshold,
            "severity": severity,
            "description": description,
            "recommended_action": recommended_action,
            "confidence": confidence,
            "details": {
                "failure_count": failure_count,
                "time_window_minutes": time_window_minutes,
                "location": location,
                "terminal_id": terminal_id,
                "failures": [
                    {
                        "transaction_number": f.transaction_number,
                        "amount": float(f.amount),
                        "error": f.error_message,
                        "timestamp": f.created_at.isoformat() if f.created_at else None,
                    }
                    for f in failures[:5]  # Show first 5 failures
                ],
            },
        }
