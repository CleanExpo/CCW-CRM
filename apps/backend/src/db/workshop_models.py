"""Workshop management models for equipment service tracking."""

import enum
from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import relationship

from .models_base import Base


class EquipmentStatus(str, enum.Enum):
    active = "active"
    in_service = "in_service"
    retired = "retired"


class BookingStatus(str, enum.Enum):
    scheduled = "scheduled"
    confirmed = "confirmed"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"
    no_show = "no_show"


class ReminderStatus(str, enum.Enum):
    pending = "pending"
    sent = "sent"
    failed = "failed"
    suppressed = "suppressed"


class Equipment(Base):
    __tablename__ = "equipment"

    id = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)
    customer_id = Column(PostgresUUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(PostgresUUID(as_uuid=True), ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True)
    serial_number = Column(String(100), nullable=False, unique=True, index=True)
    make = Column(String(100), nullable=False)
    model = Column(String(200), nullable=False)
    year = Column(Integer, nullable=True)
    location = Column(String(50), nullable=False, index=True)
    purchase_date = Column(DateTime(timezone=True), nullable=True)
    warranty_expiry = Column(DateTime(timezone=True), nullable=True)
    status = Column(Enum(EquipmentStatus), nullable=False, default=EquipmentStatus.active, index=True)
    interval_months = Column(Integer, nullable=True)
    interval_hours = Column(Float, nullable=True)
    current_hours = Column(Float, nullable=False, default=0.0)
    last_service_date = Column(DateTime(timezone=True), nullable=True)
    last_service_hours = Column(Float, nullable=True)
    next_service_date = Column(DateTime(timezone=True), nullable=True, index=True)
    next_service_hours = Column(Float, nullable=True)
    reminder_lead_days = Column(Integer, nullable=False, default=90)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC), nullable=False)

    # Relationships
    bookings = relationship("WorkshopBooking", back_populates="equipment", lazy="select")
    reminders = relationship("ServiceReminder", back_populates="equipment", cascade="all, delete-orphan", lazy="select")
    service_history = relationship("EquipmentServiceHistory", back_populates="equipment", lazy="select")


class ServiceTemplate(Base):
    __tablename__ = "service_templates"

    id = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(200), nullable=False)
    service_type = Column(String(50), nullable=False)
    applies_to_make = Column(String(100), nullable=True)
    applies_to_model = Column(String(200), nullable=True)
    description = Column(Text, nullable=False, default="")
    estimated_hours = Column(Float, nullable=False, default=1.0)
    location = Column(String(50), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC), nullable=False)

    items = relationship("ServiceTemplateItem", back_populates="template", cascade="all, delete-orphan", lazy="select")
    bookings = relationship("WorkshopBooking", back_populates="template", lazy="select")


class ServiceTemplateItem(Base):
    __tablename__ = "service_template_items"

    id = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)
    template_id = Column(PostgresUUID(as_uuid=True), ForeignKey("service_templates.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(PostgresUUID(as_uuid=True), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)
    quantity = Column(Integer, nullable=False, default=1)
    lead_time_days = Column(Integer, nullable=False, default=14)
    notes = Column(Text, nullable=True)

    template = relationship("ServiceTemplate", back_populates="items")


class WorkshopBooking(Base):
    __tablename__ = "workshop_bookings"

    id = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)
    booking_number = Column(String(20), nullable=False, unique=True, index=True)
    equipment_id = Column(PostgresUUID(as_uuid=True), ForeignKey("equipment.id", ondelete="CASCADE"), nullable=False, index=True)
    service_request_id = Column(PostgresUUID(as_uuid=True), ForeignKey("service_requests.id", ondelete="SET NULL"), nullable=True)
    service_template_id = Column(PostgresUUID(as_uuid=True), ForeignKey("service_templates.id", ondelete="SET NULL"), nullable=True)
    contractor_id = Column(PostgresUUID(as_uuid=True), ForeignKey("contractors.id", ondelete="SET NULL"), nullable=True)
    location = Column(String(50), nullable=False, index=True)
    scheduled_date = Column(DateTime(timezone=True), nullable=False, index=True)
    estimated_end_datetime = Column(DateTime(timezone=True), nullable=True)
    status = Column(Enum(BookingStatus), nullable=False, default=BookingStatus.scheduled, index=True)
    purchase_order_id = Column(PostgresUUID(as_uuid=True), nullable=True)
    parts_ordered_at = Column(DateTime(timezone=True), nullable=True)
    actual_hours = Column(Float, nullable=True)
    hours_on_completion = Column(Float, nullable=True)
    technician_notes = Column(Text, nullable=True)
    customer_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC), nullable=False)

    equipment = relationship("Equipment", back_populates="bookings")
    template = relationship("ServiceTemplate", back_populates="bookings")
    reminders = relationship("ServiceReminder", back_populates="booking", lazy="select")
    service_history = relationship("EquipmentServiceHistory", back_populates="booking", lazy="select")


class ServiceReminder(Base):
    __tablename__ = "service_reminders"

    id = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)
    equipment_id = Column(PostgresUUID(as_uuid=True), ForeignKey("equipment.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(PostgresUUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    reminder_type = Column(String(20), nullable=False)
    scheduled_send_at = Column(DateTime(timezone=True), nullable=False, index=True)
    status = Column(Enum(ReminderStatus), nullable=False, default=ReminderStatus.pending, index=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    booking_id = Column(PostgresUUID(as_uuid=True), ForeignKey("workshop_bookings.id", ondelete="SET NULL"), nullable=True)
    email_subject = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC), nullable=False)

    equipment = relationship("Equipment", back_populates="reminders")
    booking = relationship("WorkshopBooking", back_populates="reminders")


class EquipmentServiceHistory(Base):
    __tablename__ = "equipment_service_history"

    id = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)
    equipment_id = Column(PostgresUUID(as_uuid=True), ForeignKey("equipment.id", ondelete="CASCADE"), nullable=False, index=True)
    booking_id = Column(PostgresUUID(as_uuid=True), ForeignKey("workshop_bookings.id", ondelete="SET NULL"), nullable=True)
    service_date = Column(DateTime(timezone=True), nullable=False)
    service_type = Column(String(100), nullable=False)
    technician = Column(String(200), nullable=True)
    hours_at_service = Column(Float, nullable=True)
    next_service_date = Column(DateTime(timezone=True), nullable=True)
    next_service_hours = Column(Float, nullable=True)
    parts_used = Column(JSON, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False)

    equipment = relationship("Equipment", back_populates="service_history")
    booking = relationship("WorkshopBooking", back_populates="service_history")
