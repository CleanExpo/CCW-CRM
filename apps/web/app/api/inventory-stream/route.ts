import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  const encoder = new TextEncoder();
  let interval: ReturnType<typeof setInterval> | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(encoder.encode('event: connected\ndata: {"status":"connected"}\n\n'));

      // Keep-alive ping every 15s
      interval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keep-alive\n\n'));
        } catch {
          clearInterval(interval);
        }
      }, 15000);

      // Close after 25s (Vercel edge 30s limit)
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
      // Client disconnected — clean up timers so the timeout doesn't
      // attempt to close an already-cancelled controller
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
