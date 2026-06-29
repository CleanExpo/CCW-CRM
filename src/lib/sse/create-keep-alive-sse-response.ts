import { NextRequest, NextResponse } from 'next/server';

const HEARTBEAT_MS = 15_000;

/** Long-lived SSE stub with heartbeats — avoids 25s auto-close that breaks dev clients. */
export function createKeepAliveSseResponse(request?: NextRequest): NextResponse {
  const encoder = new TextEncoder();
  let interval: ReturnType<typeof setInterval> | undefined;
  let closed = false;

  const cleanup = () => {
    if (interval) {
      clearInterval(interval);
      interval = undefined;
    }
  };

  const stream = new ReadableStream({
    start(controller) {
      const safeClose = () => {
        if (closed) return;
        closed = true;
        cleanup();
        try {
          controller.close();
        } catch {
          // Stream may already be closed by client disconnect.
        }
      };

      controller.enqueue(encoder.encode('event: connected\ndata: {"status":"connected"}\n\n'));

      interval = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode('event: heartbeat\ndata: {}\n\n'));
        } catch {
          safeClose();
        }
      }, HEARTBEAT_MS);

      request?.signal.addEventListener('abort', safeClose, { once: true });
    },
    cancel() {
      closed = true;
      cleanup();
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
