import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET() {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      contactTotal,
      contactNew,
      contactRead,
      contactResponded,
      contactClosed,
      contactRecent,
      demoTotal,
      demoPending,
      demoScheduled,
      demoCompleted,
      demoCancelled,
      demoRecent,
    ] = await Promise.all([
      prisma.contactSubmission.count(),
      prisma.contactSubmission.count({ where: { status: 'new' } }),
      prisma.contactSubmission.count({ where: { status: 'read' } }),
      prisma.contactSubmission.count({ where: { status: 'responded' } }),
      prisma.contactSubmission.count({ where: { status: 'closed' } }),
      prisma.contactSubmission.count({ where: { createdAt: { gte: since } } }),
      prisma.demoRequest.count(),
      prisma.demoRequest.count({ where: { status: 'pending' } }),
      prisma.demoRequest.count({ where: { status: 'scheduled' } }),
      prisma.demoRequest.count({ where: { status: 'completed' } }),
      prisma.demoRequest.count({ where: { status: 'cancelled' } }),
      prisma.demoRequest.count({ where: { createdAt: { gte: since } } }),
    ]);

    return NextResponse.json({
      contact_submissions: {
        total: contactTotal,
        new: contactNew,
        read: contactRead,
        responded: contactResponded,
        closed: contactClosed,
        recent_24h: contactRecent,
      },
      demo_requests: {
        total: demoTotal,
        pending: demoPending,
        scheduled: demoScheduled,
        completed: demoCompleted,
        cancelled: demoCancelled,
        recent_24h: demoRecent,
      },
      total_submissions: contactTotal + demoTotal,
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
