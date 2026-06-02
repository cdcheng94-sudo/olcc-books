import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Runs on every request (per the matcher below). Refreshes the Supabase
 * session cookie if needed and redirects unauthenticated requests to
 * /auth/login. See lib/supabase/middleware.ts for the implementation.
 *
 * Once a user is authenticated, the email-whitelist check lives in
 * app/(app)/layout.tsx so we can throw a friendly UI rather than a
 * redirect loop (middleware can't show JSX).
 */
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Run on everything except static assets and image files
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
