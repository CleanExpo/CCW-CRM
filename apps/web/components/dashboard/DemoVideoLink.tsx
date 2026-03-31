"use client";

import { PlayCircle, ExternalLink, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DemoVideoLinkProps {
  /** Module key matching video-registry.json (e.g. "products", "orders") */
  module: string;
  /** YouTube video ID — null means video not yet produced */
  youtubeId?: string | null;
  /** Full YouTube URL override (if youtubeId not provided) */
  youtubeUrl?: string | null;
  /** Video title for tooltip */
  title?: string;
  /** Video duration in seconds */
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
 * DemoVideoLink — Placeholder that links to a Unite-Group YouTube demo video.
 *
 * When youtubeId is null (video not yet produced), shows a "Coming soon" state.
 * When youtubeId is set, links directly to the YouTube video.
 *
 * Usage in any dashboard page:
 *   <DemoVideoLink module="products" youtubeId={null} duration={120} />
 *
 * Once video is produced and uploaded, update youtubeId:
 *   <DemoVideoLink module="products" youtubeId="dQw4w9WgXcQ" duration={120} />
 */
export function DemoVideoLink({
  module,
  youtubeId,
  youtubeUrl,
  title,
  duration,
  variant = "button",
}: DemoVideoLinkProps) {
  const url = youtubeId
    ? `https://www.youtube.com/watch?v=${youtubeId}`
    : youtubeUrl ?? null;

  const isAvailable = url !== null;
  const displayTitle = title ?? `Watch ${module} demo`;
  const durationLabel = duration ? formatDuration(duration) : null;

  if (variant === "icon") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {isAvailable ? (
              <a
                href={url!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors"
              >
                <PlayCircle className="h-5 w-5" />
              </a>
            ) : (
              <span className="inline-flex items-center text-gray-400 cursor-default">
                <Clock className="h-5 w-5" />
              </span>
            )}
          </TooltipTrigger>
          <TooltipContent>
            {isAvailable ? displayTitle : `${displayTitle} — coming soon`}
            {durationLabel && ` (${durationLabel})`}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (variant === "banner") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
        {isAvailable ? (
          <>
            <PlayCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
            <span className="text-blue-900 font-medium">{displayTitle}</span>
            {durationLabel && (
              <span className="text-blue-600 text-xs">({durationLabel})</span>
            )}
            <a
              href={url!}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium text-xs"
            >
              Watch <ExternalLink className="h-3 w-3" />
            </a>
          </>
        ) : (
          <>
            <Clock className="h-5 w-5 text-gray-400 flex-shrink-0" />
            <span className="text-gray-600">{displayTitle}</span>
            <span className="ml-auto text-gray-400 text-xs">Coming soon</span>
          </>
        )}
      </div>
    );
  }

  // Default: button variant
  if (isAvailable) {
    return (
      <Button variant="outline" size="sm" asChild>
        <a href={url!} target="_blank" rel="noopener noreferrer" className="gap-2">
          <PlayCircle className="h-4 w-4" />
          {displayTitle}
          {durationLabel && (
            <span className="text-muted-foreground text-xs">({durationLabel})</span>
          )}
          <ExternalLink className="h-3 w-3" />
        </a>
      </Button>
    );
  }

  return (
    <Button variant="outline" size="sm" disabled className="gap-2">
      <Clock className="h-4 w-4" />
      {displayTitle}
      <span className="text-xs">(coming soon)</span>
    </Button>
  );
}
