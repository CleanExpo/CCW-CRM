import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { logger } from "@/lib/logger";

// RA-3814 — HMAC-SHA256 verification of webhook payloads.
// Sibling of RA-3020 (CleanExpo/CARSI#111). Helper logic is identical.
//
// Caller contract:
//   Header  x-webhook-signature   value of `sha256=<hex>` OR raw hex
//   Body    raw bytes (request.text() — DO NOT parse JSON before verifying)
//   Secret  process.env.WEBHOOK_SECRET — required; route 503s if unset.
//
// Mismatches return 401 without logging the payload (avoid log poisoning).
function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const provided = signature.startsWith("sha256=") ? signature.slice(7) : signature;
  if (!/^[0-9a-f]+$/i.test(provided)) return false;

  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expected, "hex"));
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.WEBHOOK_SECRET;
  if (!webhookSecret?.trim()) {
    return NextResponse.json(
      { error: "Webhook not configured (WEBHOOK_SECRET)." },
      { status: 503 }
    );
  }

  const signature = request.headers.get("x-webhook-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing x-webhook-signature" }, { status: 401 });
  }

  // Read raw body for HMAC verification BEFORE parsing JSON.
  const rawBody = await request.text();

  if (!verifySignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Signature verified — safe to parse + dispatch.
  let body: { event?: string; data?: unknown };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { event, data } = body;

  try {
    switch (event) {
      case "task.completed":
        logger.info("Task completed", { data });
        break;
      case "task.failed":
        logger.warn("Task failed", { data });
        break;
      case "agent.status":
        logger.info("Agent status update", { data });
        break;
      default:
        logger.warn("Unknown webhook event", { event, data });
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error("Webhook error", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
