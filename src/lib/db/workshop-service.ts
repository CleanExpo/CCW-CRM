import type { Prisma } from '@prisma/client';
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfDay,
  endOfWeek,
  startOfDay,
  startOfWeek,
  subDays,
} from 'date-fns';
import { prisma } from '@/lib/db/prisma';
import type {
  DashboardData,
  Equipment,
  EquipmentCreate,
  EquipmentStatus,
  Paginated,
  ServiceReminder,
  ServiceTemplate,
  ServiceTemplateItem,
  WorkshopBooking,
} from '@/lib/api/workshop-types';

function isoDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function isoDateTime(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString();
}

export function equipmentToApi(row: {
  id: string;
  customerId: string;
  productId: string | null;
  serialNumber: string;
  make: string;
  model: string;
  year: number | null;
  location: string;
  purchaseDate: Date | null;
  warrantyExpiry: Date | null;
  status: string;
  intervalMonths: number | null;
  intervalHours: number | null;
  currentHours: number;
  lastServiceDate: Date | null;
  lastServiceHours: number | null;
  nextServiceDate: Date | null;
  nextServiceHours: number | null;
  reminderLeadDays: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Equipment {
  return {
    id: row.id,
    customer_id: row.customerId,
    product_id: row.productId,
    serial_number: row.serialNumber,
    make: row.make,
    model: row.model,
    year: row.year,
    location: row.location,
    purchase_date: isoDate(row.purchaseDate),
    warranty_expiry: isoDate(row.warrantyExpiry),
    status: row.status as EquipmentStatus,
    interval_months: row.intervalMonths,
    interval_hours: row.intervalHours,
    current_hours: row.currentHours,
    last_service_date: isoDate(row.lastServiceDate),
    last_service_hours: row.lastServiceHours,
    next_service_date: isoDate(row.nextServiceDate),
    next_service_hours: row.nextServiceHours,
    reminder_lead_days: row.reminderLeadDays,
    notes: row.notes,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function templateItemToApi(row: {
  id: string;
  templateId: string;
  productId: string;
  quantity: number;
  leadTimeDays: number;
  notes: string | null;
}): ServiceTemplateItem {
  return {
    id: row.id,
    template_id: row.templateId,
    product_id: row.productId,
    quantity: row.quantity,
    lead_time_days: row.leadTimeDays,
    notes: row.notes,
  };
}

export function templateToApi(
  row: Prisma.WorkshopServiceTemplateGetPayload<{ include: { items: { include: { product: true } } } }>
): ServiceTemplate {
  return {
    id: row.id,
    name: row.name,
    service_type: row.serviceType,
    applies_to_make: row.appliesToMake,
    applies_to_model: row.appliesToModel,
    description: row.description,
    estimated_hours: row.estimatedHours,
    location: row.location,
    is_active: row.isActive,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    items: row.items.map(templateItemToApi),
  };
}

export function bookingToApi(row: {
  id: string;
  bookingNumber: string;
  equipmentId: string;
  serviceRequestId: string | null;
  serviceTemplateId: string | null;
  contractorId: string | null;
  location: string;
  scheduledDate: Date;
  estimatedEndDatetime: Date | null;
  status: string;
  purchaseOrderId: string | null;
  partsOrderedAt: Date | null;
  actualHours: number | null;
  hoursOnCompletion: number | null;
  technicianNotes: string | null;
  customerNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): WorkshopBooking {
  return {
    id: row.id,
    booking_number: row.bookingNumber,
    equipment_id: row.equipmentId,
    service_request_id: row.serviceRequestId,
    service_template_id: row.serviceTemplateId,
    contractor_id: row.contractorId,
    location: row.location,
    scheduled_date: row.scheduledDate.toISOString(),
    estimated_end_datetime: isoDateTime(row.estimatedEndDatetime),
    status: row.status as WorkshopBooking['status'],
    purchase_order_id: row.purchaseOrderId,
    parts_ordered_at: isoDateTime(row.partsOrderedAt),
    actual_hours: row.actualHours,
    hours_on_completion: row.hoursOnCompletion,
    technician_notes: row.technicianNotes,
    customer_notes: row.customerNotes,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function reminderToApi(row: {
  id: string;
  equipmentId: string;
  customerId: string;
  reminderType: string;
  scheduledSendAt: Date;
  status: string;
  sentAt: Date | null;
  bookingId: string | null;
  emailSubject: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ServiceReminder {
  return {
    id: row.id,
    equipment_id: row.equipmentId,
    customer_id: row.customerId,
    reminder_type: row.reminderType,
    scheduled_send_at: row.scheduledSendAt.toISOString(),
    status: row.status as ServiceReminder['status'],
    sent_at: isoDateTime(row.sentAt),
    booking_id: row.bookingId,
    email_subject: row.emailSubject,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function listWorkshopEquipment(
  workspaceUserIds: string[],
  params: {
    page: number;
    pageSize: number;
    customerId?: string;
    location?: string;
    status?: string;
    overdueOnly?: boolean;
    search?: string;
  }
): Promise<Paginated<Equipment>> {
  const andParts: Prisma.WorkshopEquipmentWhereInput[] = [
    { ownerUserId: { in: workspaceUserIds } },
  ];
  if (params.customerId) andParts.push({ customerId: params.customerId });
  if (params.location) andParts.push({ location: { equals: params.location, mode: 'insensitive' } });
  if (params.status) andParts.push({ status: params.status });
  if (params.overdueOnly) {
    andParts.push(
      { nextServiceDate: { not: null } },
      { nextServiceDate: { lt: startOfDay(new Date()) } },
      { status: 'active' }
    );
  }
  if (params.search?.trim()) {
    const q = params.search.trim();
    andParts.push({
      OR: [
        { make: { contains: q, mode: 'insensitive' } },
        { model: { contains: q, mode: 'insensitive' } },
        { serialNumber: { contains: q, mode: 'insensitive' } },
      ],
    });
  }

  const where: Prisma.WorkshopEquipmentWhereInput = { AND: andParts };

  const [rows, total] = await Promise.all([
    prisma.workshopEquipment.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    prisma.workshopEquipment.count({ where }),
  ]);

  return {
    items: rows.map(equipmentToApi),
    total,
    page: params.page,
    page_size: params.pageSize,
    total_pages: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

export async function getWorkshopEquipmentById(workspaceUserIds: string[], id: string) {
  const row = await prisma.workshopEquipment.findFirst({
    where: { id, ownerUserId: { in: workspaceUserIds } },
  });
  if (!row) return null;

  const [completedBookings, reminders, upcomingBookings] = await Promise.all([
    prisma.workshopBooking.findMany({
      where: { equipmentId: id, status: 'completed' },
      orderBy: { scheduledDate: 'desc' },
      take: 25,
    }),
    prisma.workshopServiceReminder.findMany({
      where: { equipmentId: id },
      orderBy: { scheduledSendAt: 'desc' },
      take: 50,
    }),
    prisma.workshopBooking.findMany({
      where: { equipmentId: id, status: { not: 'cancelled' } },
      orderBy: { scheduledDate: 'desc' },
      take: 25,
    }),
  ]);

  const service_history = completedBookings.map((b) => ({
    booking_id: b.id,
    service_date: b.scheduledDate.toISOString(),
    hours: b.actualHours,
    notes: b.technicianNotes,
  }));

  return {
    equipment: equipmentToApi(row),
    service_history,
    reminders: reminders.map((r) => reminderToApi(r)),
    bookings: upcomingBookings.map((b) => bookingToApi(b)),
  };
}

export async function createWorkshopEquipment(
  workspaceUserIds: string[],
  ownerUserId: string,
  body: EquipmentCreate
) {
  const customer = await prisma.customer.findFirst({
    where: { id: body.customer_id, ownerUserId: { in: workspaceUserIds } },
  });
  if (!customer) throw new Error('Customer not found in workspace');

  let productId: string | null = body.product_id ?? null;
  if (productId) {
    const product = await prisma.product.findFirst({
      where: { id: productId, ownerUserId: { in: workspaceUserIds } },
    });
    if (!product) throw new Error('Product not found in workspace');
  }

  const row = await prisma.workshopEquipment.create({
    data: {
      ownerUserId,
      customerId: body.customer_id,
      productId,
      serialNumber: body.serial_number,
      make: body.make,
      model: body.model,
      year: body.year ?? null,
      location: body.location,
      purchaseDate: body.purchase_date ? new Date(body.purchase_date) : null,
      warrantyExpiry: body.warranty_expiry ? new Date(body.warranty_expiry) : null,
      intervalMonths: body.interval_months ?? null,
      intervalHours: body.interval_hours ?? null,
      currentHours: body.current_hours ?? 0,
      lastServiceDate: body.last_service_date ? new Date(body.last_service_date) : null,
      lastServiceHours: body.last_service_hours ?? null,
      nextServiceDate: body.next_service_date ? new Date(body.next_service_date) : null,
      nextServiceHours: body.next_service_hours ?? null,
      reminderLeadDays: body.reminder_lead_days ?? 14,
      notes: body.notes ?? null,
    },
  });
  return equipmentToApi(row);
}

export async function updateWorkshopEquipment(
  workspaceUserIds: string[],
  id: string,
  patch: Partial<EquipmentCreate> & { status?: EquipmentStatus }
) {
  const existing = await prisma.workshopEquipment.findFirst({
    where: { id, ownerUserId: { in: workspaceUserIds } },
  });
  if (!existing) return null;

  const data: Prisma.WorkshopEquipmentUpdateInput = {};
  if (patch.customer_id !== undefined) {
    const c = await prisma.customer.findFirst({
      where: { id: patch.customer_id, ownerUserId: { in: workspaceUserIds } },
    });
    if (!c) throw new Error('Customer not found in workspace');
    data.customer = { connect: { id: patch.customer_id } };
  }
  if (patch.product_id !== undefined) {
    if (patch.product_id) {
      const p = await prisma.product.findFirst({
        where: { id: patch.product_id, ownerUserId: { in: workspaceUserIds } },
      });
      if (!p) throw new Error('Product not found in workspace');
      data.product = { connect: { id: patch.product_id } };
    } else {
      data.product = { disconnect: true };
    }
  }
  if (patch.serial_number !== undefined) data.serialNumber = patch.serial_number;
  if (patch.make !== undefined) data.make = patch.make;
  if (patch.model !== undefined) data.model = patch.model;
  if (patch.year !== undefined) data.year = patch.year;
  if (patch.location !== undefined) data.location = patch.location;
  if (patch.purchase_date !== undefined)
    data.purchaseDate = patch.purchase_date ? new Date(patch.purchase_date) : null;
  if (patch.warranty_expiry !== undefined)
    data.warrantyExpiry = patch.warranty_expiry ? new Date(patch.warranty_expiry) : null;
  if (patch.interval_months !== undefined) data.intervalMonths = patch.interval_months;
  if (patch.interval_hours !== undefined) data.intervalHours = patch.interval_hours;
  if (patch.current_hours !== undefined) data.currentHours = patch.current_hours;
  if (patch.last_service_date !== undefined)
    data.lastServiceDate = patch.last_service_date ? new Date(patch.last_service_date) : null;
  if (patch.last_service_hours !== undefined) data.lastServiceHours = patch.last_service_hours;
  if (patch.next_service_date !== undefined)
    data.nextServiceDate = patch.next_service_date ? new Date(patch.next_service_date) : null;
  if (patch.next_service_hours !== undefined) data.nextServiceHours = patch.next_service_hours;
  if (patch.reminder_lead_days !== undefined) data.reminderLeadDays = patch.reminder_lead_days;
  if (patch.notes !== undefined) data.notes = patch.notes;
  if (patch.status !== undefined) data.status = patch.status;

  const row = await prisma.workshopEquipment.update({ where: { id }, data });
  return equipmentToApi(row);
}

export async function retireWorkshopEquipment(workspaceUserIds: string[], id: string) {
  const existing = await prisma.workshopEquipment.findFirst({
    where: { id, ownerUserId: { in: workspaceUserIds } },
  });
  if (!existing) return false;
  await prisma.workshopEquipment.update({
    where: { id },
    data: { status: 'retired' },
  });
  return true;
}

export async function updateEquipmentHours(workspaceUserIds: string[], id: string, currentHours: number) {
  const existing = await prisma.workshopEquipment.findFirst({
    where: { id, ownerUserId: { in: workspaceUserIds } },
  });
  if (!existing) return null;
  const row = await prisma.workshopEquipment.update({
    where: { id },
    data: { currentHours },
  });
  return equipmentToApi(row);
}

export async function recordEquipmentService(
  workspaceUserIds: string[],
  id: string,
  data: { service_date: string; service_type: string; technician?: string; hours_at_service?: number; notes?: string }
) {
  const existing = await prisma.workshopEquipment.findFirst({
    where: { id, ownerUserId: { in: workspaceUserIds } },
  });
  if (!existing) return null;

  const serviceDate = new Date(data.service_date);
  const hours = data.hours_at_service ?? existing.currentHours;
  const nextDate =
    existing.intervalMonths != null && existing.intervalMonths > 0
      ? addMonths(startOfDay(serviceDate), existing.intervalMonths)
      : existing.nextServiceDate;

  const row = await prisma.workshopEquipment.update({
    where: { id },
    data: {
      lastServiceDate: serviceDate,
      lastServiceHours: hours,
      currentHours: hours,
      nextServiceDate: nextDate ?? existing.nextServiceDate,
    },
  });
  return equipmentToApi(row);
}

async function nextBookingNumber(ownerUserId: string): Promise<string> {
  const n = await prisma.workshopBooking.count({ where: { ownerUserId } });
  return `WB-${String(n + 1).padStart(5, '0')}`;
}

export async function listWorkshopTemplates(
  workspaceUserIds: string[],
  params: { page: number; pageSize: number; make?: string; serviceType?: string; isActive?: boolean }
): Promise<Paginated<ServiceTemplate>> {
  const where: Prisma.WorkshopServiceTemplateWhereInput = {
    ownerUserId: { in: workspaceUserIds },
  };
  if (params.make) where.appliesToMake = { contains: params.make, mode: 'insensitive' };
  if (params.serviceType) where.serviceType = { contains: params.serviceType, mode: 'insensitive' };
  if (params.isActive !== undefined) where.isActive = params.isActive;

  const [rows, total] = await Promise.all([
    prisma.workshopServiceTemplate.findMany({
      where,
      include: { items: { include: { product: true } } },
      orderBy: { name: 'asc' },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    prisma.workshopServiceTemplate.count({ where }),
  ]);

  return {
    items: rows.map(templateToApi),
    total,
    page: params.page,
    page_size: params.pageSize,
    total_pages: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

export async function getWorkshopTemplateById(workspaceUserIds: string[], id: string) {
  const row = await prisma.workshopServiceTemplate.findFirst({
    where: { id, ownerUserId: { in: workspaceUserIds } },
    include: { items: { include: { product: true } } },
  });
  return row ? templateToApi(row) : null;
}

export async function createWorkshopTemplate(
  workspaceUserIds: string[],
  ownerUserId: string,
  body: Record<string, unknown>
) {
  const name = String(body.name ?? '').trim();
  const serviceType = String(body.service_type ?? 'general').trim();
  if (!name) throw new Error('name is required');

  const itemsRaw = (body.items as Array<{ product_id?: string; quantity?: number; lead_time_days?: number; notes?: string }>) ?? [];

  const template = await prisma.$transaction(async (tx) => {
    const t = await tx.workshopServiceTemplate.create({
      data: {
        ownerUserId,
        name,
        serviceType,
        appliesToMake: (body.applies_to_make as string) || null,
        appliesToModel: (body.applies_to_model as string) || null,
        description: String(body.description ?? ''),
        estimatedHours: Number(body.estimated_hours ?? 1) || 1,
        location: (body.location as string) || null,
        isActive: body.is_active !== false,
      },
    });

    for (const line of itemsRaw) {
      const pid = String(line.product_id ?? '');
      if (!pid) continue;
      const p = await tx.product.findFirst({
        where: { id: pid, ownerUserId: { in: workspaceUserIds } },
      });
      if (!p) throw new Error(`Product ${pid} not in workspace`);
      await tx.workshopServiceTemplateItem.create({
        data: {
          templateId: t.id,
          productId: pid,
          quantity: Math.max(1, Number(line.quantity ?? 1)),
          leadTimeDays: Math.max(0, Number(line.lead_time_days ?? 0)),
          notes: line.notes ?? null,
        },
      });
    }

    return tx.workshopServiceTemplate.findUniqueOrThrow({
      where: { id: t.id },
      include: { items: { include: { product: true } } },
    });
  });

  return templateToApi(template);
}

export async function updateWorkshopTemplate(
  workspaceUserIds: string[],
  id: string,
  body: Record<string, unknown>
) {
  const existing = await prisma.workshopServiceTemplate.findFirst({
    where: { id, ownerUserId: { in: workspaceUserIds } },
  });
  if (!existing) return null;

  const itemsRaw = body.items as
    | Array<{ product_id?: string; quantity?: number; lead_time_days?: number; notes?: string }>
    | undefined;

  const template = await prisma.$transaction(async (tx) => {
    await tx.workshopServiceTemplate.update({
      where: { id },
      data: {
        name: body.name !== undefined ? String(body.name) : undefined,
        serviceType: body.service_type !== undefined ? String(body.service_type) : undefined,
        appliesToMake:
          body.applies_to_make !== undefined ? ((body.applies_to_make as string) || null) : undefined,
        appliesToModel:
          body.applies_to_model !== undefined ? ((body.applies_to_model as string) || null) : undefined,
        description: body.description !== undefined ? String(body.description) : undefined,
        estimatedHours:
          body.estimated_hours !== undefined ? Number(body.estimated_hours) || 1 : undefined,
        location: body.location !== undefined ? ((body.location as string) || null) : undefined,
        isActive: body.is_active !== undefined ? Boolean(body.is_active) : undefined,
      },
    });

    if (itemsRaw) {
      await tx.workshopServiceTemplateItem.deleteMany({ where: { templateId: id } });
      for (const line of itemsRaw) {
        const pid = String(line.product_id ?? '');
        if (!pid) continue;
        const p = await tx.product.findFirst({
          where: { id: pid, ownerUserId: { in: workspaceUserIds } },
        });
        if (!p) throw new Error(`Product ${pid} not in workspace`);
        await tx.workshopServiceTemplateItem.create({
          data: {
            templateId: id,
            productId: pid,
            quantity: Math.max(1, Number(line.quantity ?? 1)),
            leadTimeDays: Math.max(0, Number(line.lead_time_days ?? 0)),
            notes: line.notes ?? null,
          },
        });
      }
    }

    return tx.workshopServiceTemplate.findUniqueOrThrow({
      where: { id },
      include: { items: { include: { product: true } } },
    });
  });

  return templateToApi(template);
}

export async function deactivateWorkshopTemplate(workspaceUserIds: string[], id: string) {
  const existing = await prisma.workshopServiceTemplate.findFirst({
    where: { id, ownerUserId: { in: workspaceUserIds } },
  });
  if (!existing) return false;
  await prisma.workshopServiceTemplate.update({ where: { id }, data: { isActive: false } });
  return true;
}

export async function listWorkshopBookings(
  workspaceUserIds: string[],
  params: {
    page: number;
    pageSize: number;
    location?: string;
    status?: string;
    equipmentId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }
): Promise<Paginated<WorkshopBooking>> {
  const where: Prisma.WorkshopBookingWhereInput = {
    ownerUserId: { in: workspaceUserIds },
  };
  if (params.location) where.location = { equals: params.location, mode: 'insensitive' };
  if (params.status) where.status = params.status;
  if (params.equipmentId) where.equipmentId = params.equipmentId;
  if (params.dateFrom || params.dateTo) {
    where.scheduledDate = {};
    if (params.dateFrom) where.scheduledDate.gte = params.dateFrom;
    if (params.dateTo) where.scheduledDate.lte = params.dateTo;
  }

  const [rows, total] = await Promise.all([
    prisma.workshopBooking.findMany({
      where,
      orderBy: { scheduledDate: 'asc' },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    prisma.workshopBooking.count({ where }),
  ]);

  return {
    items: rows.map(bookingToApi),
    total,
    page: params.page,
    page_size: params.pageSize,
    total_pages: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

export async function getWorkshopBookingById(workspaceUserIds: string[], id: string) {
  const row = await prisma.workshopBooking.findFirst({
    where: { id, ownerUserId: { in: workspaceUserIds } },
    include: { equipment: true },
  });
  if (!row) return null;
  return {
    booking: bookingToApi(row),
    equipment: equipmentToApi(row.equipment),
  };
}

export async function createWorkshopBooking(
  workspaceUserIds: string[],
  ownerUserId: string,
  body: {
    equipment_id: string;
    service_template_id?: string;
    contractor_id?: string;
    location: string;
    scheduled_date: string;
    customer_notes?: string;
  }
) {
  const equipment = await prisma.workshopEquipment.findFirst({
    where: { id: body.equipment_id, ownerUserId: { in: workspaceUserIds } },
  });
  if (!equipment) throw new Error('Equipment not found');

  if (body.service_template_id) {
    const t = await prisma.workshopServiceTemplate.findFirst({
      where: { id: body.service_template_id, ownerUserId: { in: workspaceUserIds } },
    });
    if (!t) throw new Error('Template not found');
  }

  const bookingNumber = await nextBookingNumber(ownerUserId);
  const row = await prisma.workshopBooking.create({
    data: {
      ownerUserId,
      bookingNumber,
      equipmentId: body.equipment_id,
      serviceTemplateId: body.service_template_id ?? null,
      contractorId: body.contractor_id ?? null,
      location: body.location,
      scheduledDate: new Date(body.scheduled_date),
      customerNotes: body.customer_notes ?? null,
    },
  });
  return bookingToApi(row);
}

export async function updateWorkshopBooking(
  workspaceUserIds: string[],
  id: string,
  patch: Partial<WorkshopBooking>
) {
  const existing = await prisma.workshopBooking.findFirst({
    where: { id, ownerUserId: { in: workspaceUserIds } },
  });
  if (!existing) return null;

  const data: Prisma.WorkshopBookingUpdateInput = {};
  if (patch.scheduled_date !== undefined) data.scheduledDate = new Date(patch.scheduled_date);
  if (patch.location !== undefined) data.location = patch.location;
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.estimated_end_datetime !== undefined)
    data.estimatedEndDatetime = patch.estimated_end_datetime
      ? new Date(patch.estimated_end_datetime)
      : null;
  if (patch.customer_notes !== undefined) data.customerNotes = patch.customer_notes;
  if (patch.technician_notes !== undefined) data.technicianNotes = patch.technician_notes;
  if (patch.service_template_id !== undefined) {
    data.template = patch.service_template_id
      ? { connect: { id: patch.service_template_id } }
      : { disconnect: true };
  }

  const row = await prisma.workshopBooking.update({ where: { id }, data });
  return bookingToApi(row);
}

export async function completeWorkshopBooking(
  workspaceUserIds: string[],
  id: string,
  body: { actual_hours?: number; hours_on_completion?: number; technician_notes?: string }
) {
  const existing = await prisma.workshopBooking.findFirst({
    where: { id, ownerUserId: { in: workspaceUserIds } },
    include: { equipment: true },
  });
  if (!existing) return null;

  const row = await prisma.$transaction(async (tx) => {
    const b = await tx.workshopBooking.update({
      where: { id },
      data: {
        status: 'completed',
        actualHours: body.actual_hours ?? null,
        hoursOnCompletion: body.hours_on_completion ?? null,
        technicianNotes: body.technician_notes ?? existing.technicianNotes,
      },
    });
    if (body.hours_on_completion != null) {
      await tx.workshopEquipment.update({
        where: { id: existing.equipmentId },
        data: {
          currentHours: body.hours_on_completion,
          lastServiceDate: existing.scheduledDate,
          lastServiceHours: body.hours_on_completion,
        },
      });
    }
    return b;
  });

  return bookingToApi(row);
}

export async function listWorkshopReminders(
  workspaceUserIds: string[],
  params: { page: number; pageSize: number; status?: string }
): Promise<Paginated<ServiceReminder>> {
  const where: Prisma.WorkshopServiceReminderWhereInput = {
    ownerUserId: { in: workspaceUserIds },
  };
  if (params.status) where.status = params.status;

  const [rows, total] = await Promise.all([
    prisma.workshopServiceReminder.findMany({
      where,
      orderBy: { scheduledSendAt: 'asc' },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    prisma.workshopServiceReminder.count({ where }),
  ]);

  return {
    items: rows.map(reminderToApi),
    total,
    page: params.page,
    page_size: params.pageSize,
    total_pages: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

export async function generateWorkshopReminders(workspaceUserIds: string[]): Promise<number> {
  const equipment = await prisma.workshopEquipment.findMany({
    where: {
      ownerUserId: { in: workspaceUserIds },
      status: 'active',
      nextServiceDate: { not: null },
    },
  });

  let created = 0;
  for (const e of equipment) {
    if (!e.nextServiceDate) continue;
    const dup = await prisma.workshopServiceReminder.findFirst({
      where: {
        equipmentId: e.id,
        reminderType: 'service_due',
        status: { in: ['pending', 'failed'] },
      },
    });
    if (dup) continue;

    const dueDay = startOfDay(e.nextServiceDate);
    const sendAt = subDays(dueDay, Math.max(0, e.reminderLeadDays));

    await prisma.workshopServiceReminder.create({
      data: {
        ownerUserId: e.ownerUserId,
        equipmentId: e.id,
        customerId: e.customerId,
        reminderType: 'service_due',
        scheduledSendAt: sendAt,
        status: 'pending',
        emailSubject: `Service reminder: ${e.make} ${e.model} (${e.serialNumber})`,
      },
    });
    created += 1;
  }
  return created;
}

export async function sendWorkshopReminder(workspaceUserIds: string[], id: string) {
  const row = await prisma.workshopServiceReminder.findFirst({
    where: { id, ownerUserId: { in: workspaceUserIds } },
  });
  if (!row) return null;
  if (row.status !== 'pending' && row.status !== 'failed') return reminderToApi(row);

  const updated = await prisma.workshopServiceReminder.update({
    where: { id },
    data: { status: 'sent', sentAt: new Date() },
  });
  return reminderToApi(updated);
}

export async function sendPendingWorkshopReminders(workspaceUserIds: string[]): Promise<number> {
  const now = new Date();
  const result = await prisma.workshopServiceReminder.updateMany({
    where: {
      ownerUserId: { in: workspaceUserIds },
      status: 'pending',
      scheduledSendAt: { lte: now },
    },
    data: { status: 'sent', sentAt: now },
  });
  return result.count;
}

export async function suppressWorkshopReminder(workspaceUserIds: string[], id: string) {
  const row = await prisma.workshopServiceReminder.findFirst({
    where: { id, ownerUserId: { in: workspaceUserIds } },
  });
  if (!row) return null;
  const updated = await prisma.workshopServiceReminder.update({
    where: { id },
    data: { status: 'suppressed' },
  });
  return reminderToApi(updated);
}

export async function getWorkshopDashboard(
  workspaceUserIds: string[],
  location: string
): Promise<DashboardData> {
  const loc = location === 'all' ? null : location;
  const baseEquipment: Prisma.WorkshopEquipmentWhereInput = {
    ownerUserId: { in: workspaceUserIds },
    ...(loc ? { location: { equals: loc, mode: 'insensitive' as const } } : {}),
  };
  const baseBooking: Prisma.WorkshopBookingWhereInput = {
    ownerUserId: { in: workspaceUserIds },
    ...(loc ? { location: { equals: loc, mode: 'insensitive' as const } } : {}),
  };

  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

  const [
    todayRows,
    weekCount,
    overdueCount,
    pendingReminderCount,
    rangeBookings,
  ] = await Promise.all([
    prisma.workshopBooking.findMany({
      where: {
        ...baseBooking,
        scheduledDate: { gte: todayStart, lte: todayEnd },
        status: { not: 'cancelled' },
      },
      orderBy: { scheduledDate: 'asc' },
    }),
    prisma.workshopBooking.count({
      where: {
        ...baseBooking,
        scheduledDate: { gte: weekStart, lte: weekEnd },
        status: { not: 'cancelled' },
      },
    }),
    prisma.workshopEquipment.count({
      where: {
        ...baseEquipment,
        status: 'active',
        nextServiceDate: { lt: todayStart },
      },
    }),
    prisma.workshopServiceReminder.count({
      where: {
        ownerUserId: { in: workspaceUserIds },
        status: 'pending',
      },
    }),
    prisma.workshopBooking.findMany({
      where: {
        ...baseBooking,
        scheduledDate: {
          gte: todayStart,
          lte: endOfDay(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
        },
        status: { not: 'cancelled' },
      },
    }),
  ]);

  const upcoming_30_days: Record<string, number> = {};
  for (const b of rangeBookings) {
    const key = b.scheduledDate.toISOString().slice(0, 10);
    upcoming_30_days[key] = (upcoming_30_days[key] ?? 0) + 1;
  }

  return {
    location,
    today: {
      bookings: todayRows.map(bookingToApi),
      count: todayRows.length,
    },
    this_week: { booking_count: weekCount },
    overdue_equipment_count: overdueCount,
    pending_reminders_count: pendingReminderCount,
    upcoming_30_days,
  };
}

/** Warranty rows needing attention: expiring within 90 days or expired in the last 30 days. */
export async function getEquipmentWarrantyStats(workspaceUserIds: string[]) {
  const today = startOfDay(new Date());
  const soonEnd = endOfDay(addDays(today, 90));
  const recentExpiredStart = startOfDay(subDays(today, 30));

  const where: Prisma.WorkshopEquipmentWhereInput = {
    ownerUserId: { in: workspaceUserIds },
    warrantyExpiry: { not: null },
    OR: [
      { warrantyExpiry: { gte: today, lte: soonEnd } },
      { warrantyExpiry: { gte: recentExpiredStart, lt: today } },
    ],
  };

  const [rows, total] = await Promise.all([
    prisma.workshopEquipment.findMany({
      where,
      include: { customer: true, product: true },
      orderBy: { warrantyExpiry: 'asc' },
      take: 100,
    }),
    prisma.workshopEquipment.count({ where }),
  ]);

  const warranty_alerts = rows.map((r) => ({
    serial_number: r.serialNumber,
    product_name: r.product?.name ?? null,
    company_name: r.customer.companyName,
    days_until_expiry: differenceInCalendarDays(startOfDay(r.warrantyExpiry!), today),
  }));

  return { expiring_soon: total, warranty_alerts };
}
