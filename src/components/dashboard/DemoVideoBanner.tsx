"use client";

import { usePathname } from "next/navigation";
import { DemoVideoLink } from "./DemoVideoLink";

/**
 * CCW Training Video Registry
 *
 * YouTube Channel: Unite Group AU
 * Channel ID:  UChN8nQFig73BoefyMBIsN-w
 * Channel URL: https://www.youtube.com/channel/UChN8nQFig73BoefyMBIsN-w
 * Studio:      https://studio.youtube.com/channel/UChN8nQFig73BoefyMBIsN-w
 *
 * Each module maps to a training video on that channel.
 * Set youtubeId once the video has been uploaded — the banner auto-updates.
 * Until then, the banner links directly to the channel's video library.
 */
export const YOUTUBE_CHANNEL_ID = "UChN8nQFig73BoefyMBIsN-w";
export const YOUTUBE_CHANNEL_URL = `https://www.youtube.com/channel/${YOUTUBE_CHANNEL_ID}`;

const VIDEO_REGISTRY: Record<
  string,
  { title: string; youtubeId: string | null; duration: number }
> = {
  // Tier 1 — Core Modules
  "/dashboard":       { title: "CCW ERP — Dashboard Overview",          youtubeId: "oJxtk6x_1KY", duration: 120 },
  "/products":        { title: "CCW ERP — Products & Catalogue",         youtubeId: null, duration: 120 },
  "/customers":       { title: "CCW ERP — Customer Management",          youtubeId: "7JOQYDRdV4s", duration: 120 },
  "/orders":          { title: "CCW ERP — Orders & Fulfilment",          youtubeId: "CsZSnI9dcPg", duration: 120 },
  "/quotes":          { title: "CCW ERP — Quoting Workflow",             youtubeId: null, duration: 90 },
  "/pos":             { title: "CCW ERP — Point of Sale",                youtubeId: null, duration: 120 },
  "/invoices":        { title: "CCW ERP — Invoicing & Billing",          youtubeId: "3SOV0oloZiE", duration: 90 },
  "/warehouse":       { title: "CCW ERP — Warehouse Operations",         youtubeId: null, duration: 120 },
  "/suppliers":       { title: "CCW ERP — Supplier Management",          youtubeId: null, duration: 90 },
  "/purchase-orders": { title: "CCW ERP — Purchase Orders",              youtubeId: null, duration: 90 },
  "/contacts":        { title: "CCW ERP — Contacts & CRM",               youtubeId: "RxiIu-pIU2s", duration: 90 },
  "/reports":         { title: "CCW ERP — Reports & Analytics",          youtubeId: null, duration: 90 },
  "/settings":        { title: "CCW ERP — Settings & Configuration",     youtubeId: null, duration: 90 },

  // Tier 2 — Secondary Modules
  "/workflows":       { title: "CCW ERP — Workflow Automation",          youtubeId: null, duration: 60 },
  "/workshop":        { title: "CCW ERP — Workshop Management",          youtubeId: null, duration: 60 },
  "/ai-assistant":    { title: "CCW ERP — AI Assistant",                 youtubeId: "gcLW2hEWX0o", duration: 90 },
  "/marketing":       { title: "CCW ERP — Marketing Campaigns",          youtubeId: "K3ugQV77amw", duration: 60 },
  "/shipments":       { title: "CCW ERP — Shipment Tracking",            youtubeId: null, duration: 60 },
  "/backorders":      { title: "CCW ERP — Backorder & Auto-Reorder",     youtubeId: "Tz3UwG2dxFI", duration: 60 },
};

/**
 * DemoVideoBanner — Shows a training video link banner on every dashboard module page.
 *
 * Drop once in the dashboard layout — it auto-matches the current route.
 *
 * Behaviour:
 *  - youtubeId set   → links directly to that specific training video
 *  - youtubeId null  → links to the Unite Group AU YouTube channel (not "coming soon")
 *
 * To activate a specific video after uploading to YouTube:
 *   Set youtubeId: "VIDEO_ID" in VIDEO_REGISTRY above.
 */
/** Map URL to a top-level registry key (e.g. `/orders`) for training video lookup. */
function resolveTrainingModuleKey(pathname: string): { registryKey: string; moduleLabel: string } | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] === "dashboard" && segments[1] === "operations" && segments[2]) {
    const op = segments[2];
    if (op === "orders" || op === "fulfilment") {
      return { registryKey: "/orders", moduleLabel: op === "fulfilment" ? "fulfilment" : "orders" };
    }
    if (op === "quotes") return { registryKey: "/quotes", moduleLabel: "quotes" };
    if (op === "purchase-orders") return { registryKey: "/purchase-orders", moduleLabel: "purchase-orders" };
    if (op === "pos") return { registryKey: "/pos", moduleLabel: "pos" };
    if (op === "submissions") return null;
  }
  if (segments[0] === "dashboard" && segments[1] === "inventory" && segments[2]) {
    const inv = segments[2];
    if (inv === "products") return { registryKey: "/products", moduleLabel: "products" };
    if (inv === "warehouse") return { registryKey: "/warehouse", moduleLabel: "warehouse" };
    if (inv === "backorders") return { registryKey: "/backorders", moduleLabel: "backorders" };
  }
  if (segments.length === 0) return null;
  return { registryKey: `/${segments[0]}`, moduleLabel: segments[0] };
}

export function DemoVideoBanner() {
  const pathname = usePathname();

  const resolved = resolveTrainingModuleKey(pathname);
  if (!resolved) return null;

  const entry = VIDEO_REGISTRY[resolved.registryKey];
  if (!entry) return null;

  return (
    <div className="mb-4">
      <DemoVideoLink
        module={resolved.moduleLabel}
        youtubeId={entry.youtubeId}
        channelId={YOUTUBE_CHANNEL_ID}
        title={entry.title}
        duration={entry.duration}
        variant="banner"
      />
    </div>
  );
}
