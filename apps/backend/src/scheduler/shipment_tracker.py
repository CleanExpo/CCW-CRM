"""
Shipment auto-tracking scheduler.

Polls carrier APIs every 20 minutes for all active shipments and:
- Updates tracking_events + status in the database.
- Emails the customer when their outbound shipment status changes.
- Updates the linked Order to "delivered" when the final event fires.
- Logs inbound shipment changes for the CCW warehouse team.

The poller only contacts carriers for shipments that have a tracking_number
and are in an active (non-terminal) status.
"""

from datetime import datetime
from uuid import UUID

import structlog
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.db.demo_models import Customer, Order
from src.db.inventory_models import InboundShipment, OutboundShipment
from src.services.carrier_service import get_carrier_service

logger = structlog.get_logger(__name__)

# Statuses that still need polling (terminal statuses are skipped)
_ACTIVE_STATUSES = {"pending", "in_transit", "out_for_delivery"}

# Status labels shown to customers in notification emails
_STATUS_LABELS: dict[str, str] = {
    "pending": "Pending pickup",
    "in_transit": "In transit",
    "out_for_delivery": "Out for delivery",
    "delivered": "Delivered",
    "exception": "Delivery exception",
    "returned": "Returned to sender",
}


class ShipmentTracker:
    """
    Background scheduler that polls carrier tracking APIs and syncs
    shipment status for both CCW staff and customers.
    """

    POLL_INTERVAL_MINUTES = 20

    def __init__(self, session_maker: async_sessionmaker[AsyncSession]) -> None:
        self.session_maker = session_maker
        self.scheduler = AsyncIOScheduler()
        self._register_jobs()

    def _register_jobs(self) -> None:
        self.scheduler.add_job(
            self.poll_outbound_shipments,
            trigger=IntervalTrigger(minutes=self.POLL_INTERVAL_MINUTES),
            id="track_outbound_shipments",
            name="Auto-track outbound customer shipments",
            replace_existing=True,
            max_instances=1,
        )
        self.scheduler.add_job(
            self.poll_inbound_shipments,
            trigger=IntervalTrigger(minutes=self.POLL_INTERVAL_MINUTES),
            id="track_inbound_shipments",
            name="Auto-track inbound supplier shipments",
            replace_existing=True,
            max_instances=1,
        )

    def start(self) -> None:
        self.scheduler.start()
        logger.info(
            "Shipment tracker started",
            poll_interval_minutes=self.POLL_INTERVAL_MINUTES,
        )

    def stop(self) -> None:
        self.scheduler.shutdown(wait=False)
        logger.info("Shipment tracker stopped")

    # ------------------------------------------------------------------
    # Outbound polling (customer-facing)
    # ------------------------------------------------------------------

    async def poll_outbound_shipments(self) -> None:
        """Poll all active outbound shipments and notify customers on change."""
        async with self.session_maker() as db:
            result = await db.execute(
                select(OutboundShipment).where(
                    OutboundShipment.status.in_(_ACTIVE_STATUSES),
                    OutboundShipment.tracking_number.isnot(None),
                )
            )
            shipments = result.scalars().all()

        if not shipments:
            return

        logger.info("Polling outbound shipments", count=len(shipments))
        service = get_carrier_service()

        for shipment in shipments:
            try:
                async with self.session_maker() as db:
                    fresh = await db.get(OutboundShipment, shipment.id)
                    if fresh is None:
                        continue

                    status_data = await service.track_shipment(
                        tracking_number=fresh.tracking_number,  # type: ignore[arg-type]
                        carrier_name=_carrier_key(fresh.carrier_name),
                    )

                    if status_data.status != fresh.status:
                        old_status = fresh.status
                        fresh.status = status_data.status
                        fresh.last_tracking_update = datetime.now()
                        fresh.tracking_events = {
                            "status": status_data.status,
                            "status_detail": status_data.status_detail,
                            "location": status_data.location,
                            "updated_at": status_data.timestamp.isoformat(),
                            "events": status_data.events,
                        }

                        if status_data.status == "delivered":
                            fresh.actual_delivery_date = datetime.now()
                            await _mark_order_delivered(db, fresh.order_id)

                        await db.commit()
                        logger.info(
                            "Outbound shipment status updated",
                            shipment_number=fresh.shipment_number,
                            old_status=old_status,
                            new_status=status_data.status,
                        )

                        await _email_customer_status_update(
                            db=db,
                            shipment=fresh,
                            new_status=status_data.status,
                            location=status_data.location,
                        )
                    else:
                        # Always bump the last_tracking_update timestamp
                        async with self.session_maker() as db2:
                            s2 = await db2.get(OutboundShipment, shipment.id)
                            if s2:
                                s2.last_tracking_update = datetime.now()
                                await db2.commit()

            except Exception as exc:
                logger.warning(
                    "Failed to poll outbound shipment",
                    shipment_id=str(shipment.id),
                    tracking_number=shipment.tracking_number,
                    error=str(exc),
                )

    # ------------------------------------------------------------------
    # Inbound polling (CCW warehouse team)
    # ------------------------------------------------------------------

    async def poll_inbound_shipments(self) -> None:
        """Poll all active inbound shipments from suppliers and update DB."""
        async with self.session_maker() as db:
            result = await db.execute(
                select(InboundShipment).where(
                    InboundShipment.status.in_(_ACTIVE_STATUSES),
                    InboundShipment.tracking_number.isnot(None),
                )
            )
            shipments = result.scalars().all()

        if not shipments:
            return

        logger.info("Polling inbound shipments", count=len(shipments))
        service = get_carrier_service()

        for shipment in shipments:
            try:
                async with self.session_maker() as db:
                    fresh = await db.get(InboundShipment, shipment.id)
                    if fresh is None:
                        continue

                    status_data = await service.track_shipment(
                        tracking_number=fresh.tracking_number,  # type: ignore[arg-type]
                        carrier_name=_carrier_key(fresh.carrier_name),
                    )

                    if status_data.status != fresh.status:
                        old_status = fresh.status
                        fresh.status = status_data.status
                        fresh.last_tracking_update = datetime.now()
                        fresh.tracking_events = {
                            "status": status_data.status,
                            "status_detail": status_data.status_detail,
                            "location": status_data.location,
                            "updated_at": status_data.timestamp.isoformat(),
                            "events": status_data.events,
                        }

                        if status_data.status == "delivered":
                            fresh.actual_delivery_date = datetime.now()

                        await db.commit()
                        logger.info(
                            "Inbound shipment status updated",
                            shipment_number=fresh.shipment_number,
                            old_status=old_status,
                            new_status=status_data.status,
                            carrier=fresh.carrier_name,
                        )

            except Exception as exc:
                logger.warning(
                    "Failed to poll inbound shipment",
                    shipment_id=str(shipment.id),
                    tracking_number=shipment.tracking_number,
                    error=str(exc),
                )


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def _carrier_key(carrier_name: str | None) -> str | None:
    """Normalise a free-text carrier name to the CarrierService key."""
    if not carrier_name:
        return None
    normalised = carrier_name.lower().replace(" ", "_").replace("-", "_")
    _aliases: dict[str, str] = {
        "australia_post": "australia_post",
        "auspost": "australia_post",
        "aus_post": "australia_post",
        "startrack": "startrack",
        "star_track": "startrack",
        "tnt": "tnt",
        "tnt_express": "tnt",
        "fedex": "fedex",
        "easypost": "easypost",
    }
    return _aliases.get(normalised)


async def _mark_order_delivered(db: AsyncSession, order_id: UUID) -> None:
    """Set the linked order status to 'delivered'."""
    order = await db.get(Order, order_id)
    if order and order.status not in ("delivered", "cancelled"):
        order.status = "delivered"
        logger.info("Order marked delivered via tracking", order_id=str(order_id))


async def _email_customer_status_update(
    db: AsyncSession,
    shipment: OutboundShipment,
    new_status: str,
    location: str | None,
) -> None:
    """Send a tracking update email to the customer linked via the order."""
    try:
        order = await db.get(Order, shipment.order_id)
        if not order:
            return

        customer = await db.get(Customer, order.customer_id)
        if not customer or not customer.email:
            return

        from src.services.email_service import EmailPurpose, get_email_service

        email_service = get_email_service()
        label = _STATUS_LABELS.get(new_status, new_status.replace("_", " ").title())
        location_line = f"<p><strong>Current location:</strong> {location}</p>" if location else ""

        html = f"""
        <p>Hi {customer.contact_name},</p>
        <p>Your shipment from CCW has been updated.</p>
        <table style="border-collapse:collapse;width:100%;max-width:480px">
          <tr><td style="padding:6px 0;color:#555">Order</td>
              <td style="padding:6px 0;font-weight:bold">{order.order_number}</td></tr>
          <tr><td style="padding:6px 0;color:#555">Tracking number</td>
              <td style="padding:6px 0">{shipment.tracking_number}</td></tr>
          <tr><td style="padding:6px 0;color:#555">Carrier</td>
              <td style="padding:6px 0">{shipment.carrier_name or "—"}</td></tr>
          <tr><td style="padding:6px 0;color:#555">Status</td>
              <td style="padding:6px 0;font-weight:bold;color:#1a56db">{label}</td></tr>
        </table>
        {location_line}
        <p style="margin-top:16px">We'll send another update when the status changes again.</p>
        <p>Thanks,<br>CCW Team</p>
        """

        text = (
            f"Hi {customer.contact_name},\n\n"
            f"Your shipment update:\n"
            f"  Order:    {order.order_number}\n"
            f"  Tracking: {shipment.tracking_number}\n"
            f"  Carrier:  {shipment.carrier_name or '—'}\n"
            f"  Status:   {label}\n"
            + (f"  Location: {location}\n" if location else "")
            + "\nThanks,\nCCW Team"
        )

        await email_service.send_email(
            to_email=customer.email,
            to_name=customer.contact_name,
            subject=f"Shipment update — {order.order_number} — {label}",
            html_content=html,
            text_content=text,
            db=db,
            purpose=EmailPurpose.TRANSACTIONAL,
            customer_id=customer.id,
            related_entity_type="outbound_shipment",
            related_entity_id=shipment.id,
        )

        logger.info(
            "Tracking email sent to customer",
            order_number=order.order_number,
            email=customer.email,
            new_status=new_status,
        )

    except Exception as exc:
        logger.warning(
            "Failed to send tracking email",
            shipment_id=str(shipment.id),
            error=str(exc),
        )


# Singleton
_tracker: ShipmentTracker | None = None


def get_shipment_tracker(
    session_maker: async_sessionmaker[AsyncSession] | None = None,
) -> ShipmentTracker:
    """Return (or create) the ShipmentTracker singleton."""
    global _tracker
    if _tracker is None:
        if session_maker is None:
            raise ValueError("session_maker required on first call")
        _tracker = ShipmentTracker(session_maker)
    return _tracker
