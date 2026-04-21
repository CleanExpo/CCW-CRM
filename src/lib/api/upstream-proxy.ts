import { NextResponse } from "next/server";
import { getUpstreamApiBase } from "@/lib/api/backend-url";

export function upstreamUnavailable(operation: string) {
  return NextResponse.json(
    {
      success: false,
      error: `${operation} requires API_UPSTREAM_URL when forwarding to an external API, or reimplement this job as a Next.js Route Handler.`,
    },
    { status: 501 }
  );
}

/** Returns upstream base URL, or a 501 response if not configured. */
export function requireUpstreamBase(
  operation: string
): string | NextResponse {
  const base = getUpstreamApiBase();
  if (!base) return upstreamUnavailable(operation);
  return base;
}
