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
    // Run on everything except static assets, image files, the PWA
    // manifest, and cron endpoints.
    //   - Cron routes do their own Bearer-token auth; running the Supabase
    //     session middleware on them would 307 the scheduled request to
    //     /auth/login and the job would silently no-op.
    //   - manifest.webmanifest MUST stay public — otherwise Android Chrome's
    //     "Add to Home Screen" can't read it and falls back to a default
    //     icon instead of the OLCC logo.
    "/((?!_next/static|_next/image|api/cron|api/drive|favicon\\.ico|icon\\.png|apple-icon\\.png|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
