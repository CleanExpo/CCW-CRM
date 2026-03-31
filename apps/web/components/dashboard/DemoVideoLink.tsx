"use client";

import { PlayCircle, ExternalLink, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Unite Group AU YouTube channel — all CCW training videos live here.
 * https://studio.youtube.com/channel/UChN8nQFig73BoefyMBIsN-w
 */
const DEFAULT_CHANNEL_URL =
  "https://www.youtube.com/channel/UCLqS3mSp4DflzZd9IILXLdQ";

interface DemoVideoLinkProps {
  /** Module key (e.g. "products", "orders") */
  module: string;
  /** YouTube video ID — null shows channel link fallback */
  youtubeId?: string | null;
  /** YouTube channel ID override */
  channelId?: string;
  /** Full URL override */
  youtubeUrl?: string | null;
  /** Video title */
  title?: string;
  /** Duration in seconds */
  duration?: number;
  /** Render style */
  variant?: "icon" | "button" | "banner";
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${m} min`;
}

/**
 * DemoVideoLink — Training video link for CCW ERP dashboard modules.
 *
 * Hardcoded to Unite Group AU channel: UChN8nQFig73BoefyMBIsN-w
 *
 * When youtubeId is set   → links to specific video: youtube.com/watch?v=VIDEO_ID
 * When youtubeId is null  → links to the CCW training channel (always clickable)
 */
export function DemoVideoLink({
  module,
  youtubeId,
  channelId,
  youtubeUrl,
  title,
  duration,
  variant = "button",
}: DemoVideoLinkProps) {
  // Specific video URL takes priority; fall back to channel
  const channelUrl = channelId
    ? `https://www.youtube.com/channel/${channelId}`
    : DEFAULT_CHANNEL_URL;

  const url = youtubeId
    ? `https://www.youtube.com/watch?v=${youtubeId}`
    : (youtubeUrl ?? channelUrl);

  const hasSpecificVideo = youtubeId !== null && youtubeId !== undefined;
  const displayTitle = title ?? `${module} training video`;
  const durationLabel = duration && hasSpecificVideo ? formatDuration(duration) : null;

  const linkLabel = hasSpecificVideo ? "Watch training video" : "Browse training videos";
  const channelLabel = hasSpecificVideo ? displayTitle : "CCW Training Videos";

  if (variant === "icon") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors"
            >
              <PlayCircle className="h-5 w-5" />
            </a>
          </TooltipTrigger>
          <TooltipContent>
            {channelLabel}
            {durationLabel && ` (${durationLabel})`}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (variant === "banner") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
        <PlayCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
        <div className="flex flex-col min-w-0">
          <span className="text-blue-900 font-medium truncate">
            {hasSpecificVideo ? displayTitle : "CCW Training Library"}
          </span>
          {!hasSpecificVideo && (
            <span className="text-blue-600 text-xs">
              Watch walkthroughs for every module
            </span>
          )}
        </div>
        {durationLabel && (
          <span className="text-blue-600 text-xs shrink-0">({durationLabel})</span>
        )}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium text-xs shrink-0"
        >
          {linkLabel} <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    );
  }

  // Default: button variant
  return (
    <Button variant="outline" size="sm" asChild>
      <a href={url} target="_blank" rel="noopener noreferrer" className="gap-2">
        <PlayCircle className="h-4 w-4" />
        {hasSpecificVideo ? displayTitle : "CCW Training Videos"}
        {durationLabel && (
          <span className="text-muted-foreground text-xs">({durationLabel})</span>
        )}
        <ExternalLink className="h-3 w-3" />
      </a>
    </Button>
  );
}
