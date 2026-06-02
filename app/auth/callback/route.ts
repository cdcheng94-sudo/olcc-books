import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth callback. Supabase sends the user here after they finish Google
 * sign-in with a one-time `code` param. We swap it for a session cookie
 * (PKCE flow), then send them to `next` (defaults to /dashboard).
 *
 * No allowlist check here — that's enforced in app/(app)/layout.tsx so
 * we can render a friendly "not authorized" page instead of bouncing.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    return NextResponse.redirect(
      `${origin}/auth/error?error=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(
    `${origin}/auth/error?error=${encodeURIComponent("Missing OAuth code")}`,
  );
}
