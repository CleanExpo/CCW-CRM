import { NextResponse } from "next/server";

import {
  TELEMETRY_EVENTS,
  type TelemetryEventName,
  type TelemetryEventPayload,
} from "@/lib/telemetry";

const allowedEvents = new Set<TelemetryEventName>(TELEMETRY_EVENTS);
const MAX_EVENTS = 200;

type TelemetryRecord = TelemetryEventPayload & { receivedAt: string };

const buffer: TelemetryRecord[] = [];

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { name, metadata, occurredAt, path } = body as TelemetryEventPayload;

  if (!name || !allowedEvents.has(name)) {
    return NextResponse.json({ error: "Unknown telemetry event" }, { status: 400 });
  }

  const record: TelemetryRecord = {
    name,
    metadata:
      metadata && typeof metadata === "object" && !Array.isArray(metadata)
        ? metadata
        : {},
    occurredAt: typeof occurredAt === "string" ? occurredAt : new Date().toISOString(),
    path: typeof path === "string" ? path : "",
    receivedAt: new Date().toISOString(),
  };

  buffer.push(record);
  if (buffer.length > MAX_EVENTS) {
    buffer.shift();
  }

  console.info("telemetry_event", record);

  return NextResponse.json({ ok: true });
}
