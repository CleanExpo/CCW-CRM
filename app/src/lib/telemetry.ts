export const TELEMETRY_EVENTS = [
  "showroom_visit",
  "showroom_product_selected",
  "showroom_product_added",
  "showroom_pipeline_advance",
  "showroom_pipeline_reset",
  "showroom_summary_refresh",
  "showroom_prompt_copied",
  "showroom_share_link",
  "showroom_quote_start",
  "showroom_marketing_notify",
  "showroom_order_created",
  "showroom_invoice_opened",
  "showroom_invoice_viewed",
] as const;

export type TelemetryEventName = (typeof TELEMETRY_EVENTS)[number];

export type TelemetryEventPayload = {
  name: TelemetryEventName;
  metadata?: Record<string, unknown>;
  occurredAt?: string;
  path?: string;
};

export async function trackTelemetry(event: TelemetryEventPayload): Promise<void> {
  try {
    const payload = {
      name: event.name,
      metadata: event.metadata ?? {},
      occurredAt: event.occurredAt ?? new Date().toISOString(),
      path:
        event.path ??
        (typeof window !== "undefined" ? window.location.pathname : ""),
    };

    await fetch("/api/telemetry", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Telemetry should never block the UI.
  }
}
