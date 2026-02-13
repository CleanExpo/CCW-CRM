import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    contact_submissions: {
      total: 0,
      new: 0,
      read: 0,
      responded: 0,
      closed: 0,
    },
    demo_requests: {
      total: 0,
      pending: 0,
      scheduled: 0,
      completed: 0,
      cancelled: 0,
    },
    total_submissions: 0,
  });
}
