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
  "/dashboard":       { title: "CCW ERP — Dashboard Overview",          youtubeId: null, duration: 120 },
  "/products":        { title: "CCW ERP — Products & Catalogue",         youtubeId: null, duration: 120 },
  "/customers":       { title: "CCW ERP — Customer Management",          youtubeId: null, duration: 120 },
  "/orders":          { title: "CCW ERP — Orders & Fulfilment",          youtubeId: null, duration: 120 },
  "/quotes":          { title: "CCW ERP — Quoting Workflow",             youtubeId: null, duration: 90 },
  "/pos":             { title: "CCW ERP — Point of Sale",                youtubeId: null, duration: 120 },
  "/invoices":        { title: "CCW ERP — Invoicing & Billing",          youtubeId: null, duration: 90 },
  "/warehouse":       { title: "CCW ERP — Warehouse Operations",         youtubeId: null, duration: 120 },
  "/suppliers":       { title: "CCW ERP — Supplier Management",          youtubeId: null, duration: 90 },
  "/purchase-orders": { title: "CCW ERP — Purchase Orders",              youtubeId: null, duration: 90 },
  "/contacts":        { title: "CCW ERP — Contacts & CRM",               youtubeId: null, duration: 90 },
  "/reports":         { title: "CCW ERP — Reports & Analytics",          youtubeId: null, duration: 90 },
  "/settings":        { title: "CCW ERP — Settings & Configuration",     youtubeId: null, duration: 90 },

  // Tier 2 — Secondary Modules
  "/workflows":       { title: "CCW ERP — Workflow Automation",          youtubeId: null, duration: 60 },
  "/workshop":        { title: "CCW ERP — Workshop Management",          youtubeId: null, duration: 60 },
  "/ai-assistant":    { title: "CCW ERP — AI Assistant",                 youtubeId: null, duration: 90 },
  "/marketing":       { title: "CCW ERP — Marketing Campaigns",          youtubeId: null, duration: 60 },
  "/shipments":       { title: "CCW ERP — Shipment Tracking",            youtubeId: null, duration: 60 },
  "/backorders":      { title: "CCW ERP — Backorder & Auto-Reorder",     youtubeId: null, duration: 60 },
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
export function DemoVideoBanner() {
  const pathname = usePathname();

  const segments = pathname.split("/").filter(Boolean);
  const moduleKey = segments.length > 0 ? `/${segments[0]}` : null;
  if (!moduleKey) return null;

  const entry = VIDEO_REGISTRY[moduleKey];
  if (!entry) return null;

  return (
    <div className="mb-4">
      <DemoVideoLink
        module={moduleKey.slice(1)}
        youtubeId={entry.youtubeId}
        channelId={YOUTUBE_CHANNEL_ID}
        title={entry.title}
        duration={entry.duration}
        variant="banner"
      />
    </div>
  );
}
