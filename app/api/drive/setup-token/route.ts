import { NextResponse } from "next/server";
import { getOAuthClient, DRIVE_SCOPE } from "@/lib/drive";

/**
 * One-time helper to obtain a Drive refresh_token. Visit with the archive
 * account:
 *   /api/drive/setup-token?secret=<DRIVE_SETUP_SECRET>
 * → redirects to Google consent → callback prints the refresh_token.
 *
 * Guarded by DRIVE_SETUP_SECRET so it can't be triggered by randoms.
 * access_type=offline + prompt=consent guarantees a refresh_token is issued.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!process.env.DRIVE_SETUP_SECRET || url.searchParams.get("secret") !== process.env.DRIVE_SETUP_SECRET) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  if (!process.env.GOOGLE_DRIVE_CLIENT_ID || !process.env.GOOGLE_DRIVE_CLIENT_SECRET) {
    return new NextResponse("GOOGLE_DRIVE_CLIENT_ID / SECRET not set", { status: 500 });
  }

  const redirectUri = `${url.origin}/api/drive/oauth-callback`;
  const oauth2 = getOAuthClient(redirectUri);
  const authUrl = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [DRIVE_SCOPE],
  });
  return NextResponse.redirect(authUrl);
}
