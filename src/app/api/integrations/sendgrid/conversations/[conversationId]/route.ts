import { NextRequest, NextResponse } from 'next/server';

/** Placeholder until inbound parse / storage is wired to SendGrid. */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await context.params;
  return NextResponse.json(
    {
      success: false,
      detail: 'Conversation storage is not connected yet.',
      conversation_id: conversationId,
      conversation: null,
      messages: [],
    },
    { status: 501 }
  );
}
