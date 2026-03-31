"use client";

import { usePathname } from "next/navigation";
import { DemoVideoLink } from "./DemoVideoLink";

/**
 * Video registry — maps dashboard module paths to YouTube demo video metadata.
 *
 * YouTube Channel: Unite-Group (UCxJtkvKEpNUhulVZ0suU6yw)
 * Studio: https://studio.youtube.com/channel/UCxJtkvKEpNUhulVZ0suU6yw
 *
 * To link a produced video: set the youtubeId for the relevant module.
 * The component auto-matches the current route to the correct video.
 */
const VIDEO_REGISTRY: Record<
  string,
  { title: string; youtubeId: string | null; duration: number }
> = {
  // Tier 1 — Core Modules
  "/dashboard": { title: "Dashboard Overview", youtubeId: null, duration: 120 },
  "/products": { title: "Products Walkthrough", youtubeId: null, duration: 120 },
  "/customers": { title: "Customers Walkthrough", youtubeId: null, duration: 120 },
  "/orders": { title: "Orders Process Demo", youtubeId: null, duration: 120 },
  "/quotes": { title: "Quotes Workflow", youtubeId: null, duration: 90 },
  "/pos": { title: "POS Feature Demo", youtubeId: null, duration: 120 },
  "/invoices": { title: "Invoices & Billing", youtubeId: null, duration: 90 },
  "/warehouse": { title: "Warehouse Operations", youtubeId: null, duration: 120 },
  "/suppliers": { title: "Supplier Management", youtubeId: null, duration: 90 },
  "/purchase-orders": { title: "Purchase Orders", youtubeId: null, duration: 90 },
  "/contacts": { title: "CRM Contacts", youtubeId: null, duration: 90 },
  "/reports": { title: "Reports & Analytics", youtubeId: null, duration: 90 },
  "/settings": { title: "Settings & Configuration", youtubeId: null, duration: 90 },

  // Tier 2 — Secondary Modules
  "/workflows": { title: "Workflow Automation", youtubeId: null, duration: 60 },
  "/workshop": { title: "Workshop Management", youtubeId: null, duration: 60 },
  "/ai-assistant": { title: "AI Assistant Demo", youtubeId: null, duration: 90 },
  "/marketing": { title: "Marketing Campaigns", youtubeId: null, duration: 60 },
  "/shipments": { title: "Shipment Tracking", youtubeId: null, duration: 60 },
  "/backorders": { title: "Auto-Reorder", youtubeId: null, duration: 60 },
};

/**
 * DemoVideoBanner — Auto-renders a video link banner based on the current route.
 *
 * Drop this once in the dashboard layout. It reads the pathname, looks up the
 * matching module video, and renders a banner variant of DemoVideoLink.
 * When youtubeId is null, shows "Coming soon". When set, links to YouTube.
 *
 * No banner is shown for routes without a registered video (e.g. /settings/integrations subpages).
 */
export function DemoVideoBanner() {
  const pathname = usePathname();

  // Strip the (dashboard) group prefix if present and match the first segment
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
        title={entry.title}
        duration={entry.duration}
        variant="banner"
      />
    </div>
  );
}
