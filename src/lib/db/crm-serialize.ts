import type { CrmActivity, CrmContact, Customer } from '@prisma/client';

export function crmContactToApi(c: CrmContact, customer?: Pick<Customer, 'companyName'> | null) {
  return {
    id: c.id,
    customer_id: c.customerId,
    first_name: c.firstName,
    last_name: c.lastName,
    email: c.email,
    phone: c.phone,
    mobile: c.mobile,
    job_title: c.jobTitle,
    department: c.department,
    is_primary: c.isPrimary,
    is_active: c.isActive,
    notes: c.notes,
    created_at: c.createdAt.toISOString(),
    updated_at: c.updatedAt.toISOString(),
    ...(customer ? { customer_name: customer.companyName } : {}),
  };
}

type ActivityInclude = {
  customer: { companyName: string } | null;
  contact: { firstName: string; lastName: string } | null;
  order: { orderNumber: string } | null;
  quote: { quoteNumber: string } | null;
};

export function crmActivityToApi(
  a: CrmActivity,
  inc: ActivityInclude = {
    customer: null,
    contact: null,
    order: null,
    quote: null,
  }
) {
  const contactName =
    inc.contact != null ? `${inc.contact.firstName} ${inc.contact.lastName}`.trim() : undefined;
  return {
    id: a.id,
    activity_type: a.activityType as 'call' | 'email' | 'meeting' | 'note' | 'task',
    subject: a.subject,
    description: a.description,
    customer_id: a.customerId,
    contact_id: a.contactId,
    order_id: a.orderId,
    quote_id: a.quoteId,
    due_date: a.dueDate?.toISOString() ?? null,
    completed_at: a.completedAt?.toISOString() ?? null,
    created_by: a.createdBy,
    created_at: a.createdAt.toISOString(),
    updated_at: a.updatedAt.toISOString(),
    customer_name: inc.customer?.companyName,
    contact_name: contactName,
    order_number: inc.order?.orderNumber,
    quote_number: inc.quote?.quoteNumber,
  };
}
