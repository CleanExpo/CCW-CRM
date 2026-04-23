import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

function noteToApi(n: {
  id: string;
  noteType: string;
  content: string;
  createdBy: string | null;
  createdAt: Date;
}) {
  return {
    id: n.id,
    note_type: n.noteType,
    content: n.content,
    created_by: n.createdBy,
    created_at: n.createdAt.toISOString(),
  };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ type: string; id: string }> }
) {
  try {
    const { type, id } = await context.params;
    if (type !== 'contact' && type !== 'demo') {
      return NextResponse.json({ detail: 'Invalid submission type' }, { status: 400 });
    }

    const rows = await prisma.submissionNote.findMany({
      where:
        type === 'contact'
          ? { contactSubmissionId: id }
          : { demoRequestId: id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(rows.map(noteToApi));
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ type: string; id: string }> }
) {
  try {
    const { type, id } = await context.params;
    if (type !== 'contact' && type !== 'demo') {
      return NextResponse.json({ detail: 'Invalid submission type' }, { status: 400 });
    }

    const body = (await request.json()) as { content?: string; created_by?: string };
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (!content) {
      return NextResponse.json({ detail: 'content is required' }, { status: 400 });
    }

    if (type === 'contact') {
      const parent = await prisma.contactSubmission.findUnique({ where: { id } });
      if (!parent) return NextResponse.json({ detail: 'Not found' }, { status: 404 });
    } else {
      const parent = await prisma.demoRequest.findUnique({ where: { id } });
      if (!parent) return NextResponse.json({ detail: 'Not found' }, { status: 404 });
    }

    const row = await prisma.submissionNote.create({
      data: {
        contactSubmissionId: type === 'contact' ? id : null,
        demoRequestId: type === 'demo' ? id : null,
        content,
        createdBy: body.created_by ?? null,
        noteType: 'note',
      },
    });

    return NextResponse.json(noteToApi(row), { status: 201 });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
