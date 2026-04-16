import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  const encoder = new TextEncoder();
  let interval: ReturnType<typeof setInterval> | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('event: connected\ndata: {"status":"connected"}\n\n'));
      interval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keep-alive\n\n'));
        } catch {
          clearInterval(interval);
        }
      }, 15000);
      timeout = setTimeout(() => {
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          // Controller already closed by client disconnect — ignore
        }
      }, 25000);
    },
    cancel() {
      clearInterval(interval);
      clearTimeout(timeout);
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
