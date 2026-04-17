/**
 * Proxy middleware for CCW Online ERP (Next.js 16 convention)
 *
 * Handles JWT session management (auth).
 * i18n is handled via cookies at the layout level.
 *
 * Renamed from middleware.ts in UNI-1949 phase 2c — Next.js 16
 * renamed the middleware convention to proxy.ts. Auth logic
 * unchanged; only file name + exported function name differ.
 */

import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/api/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
