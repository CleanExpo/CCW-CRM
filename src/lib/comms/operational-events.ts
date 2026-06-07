import { prisma } from '@/lib/db/prisma';

export type LogOperationalEventInput = {
  ownerUserId: string;
  customerId?: string | null;
  eventType: string;
  source?: string;
  title: string;
  description?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
};

export async function logOperationalEvent(input: LogOperationalEventInput) {
  return prisma.operationalEvent.create({
    data: {
      ownerUserId: input.ownerUserId,
      customerId: input.customerId ?? null,
      eventType: input.eventType,
      source: input.source ?? 'system',
      title: input.title,
      description: input.description ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      metadata: (input.metadata ?? {}) as object,
      occurredAt: input.occurredAt ?? new Date(),
    },
  });
}
