import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    by_type: {},
    pending_tasks: 0,
    overdue_tasks: 0,
    completed_this_week: 0,
  });
}
