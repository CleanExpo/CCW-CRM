/**
 * Middleware for CCW Online ERP
 *
 * Handles JWT session management (auth).
 * i18n is handled via cookies at the layout level.
 */

import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/auth/update-session";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp (never under api/:
     *   an image-named API path is a route handler and still needs auth)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|(?!api/).*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
