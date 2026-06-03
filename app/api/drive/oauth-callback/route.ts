import { NextResponse } from "next/server";
import { getOAuthClient } from "@/lib/drive";

/**
 * OAuth callback for the one-time token setup. Exchanges the code for tokens
 * and renders the refresh_token on a simple page so the operator can copy it
 * into Vercel as GOOGLE_DRIVE_REFRESH_TOKEN.
 */
export const dynamic = "force-dynamic";

function page(title: string, body: string, token?: string): NextResponse {
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#f4f6fa;color:#1a2438;padding:24px;max-width:720px;margin:0 auto}
  .card{background:#fff;border:1px solid #e6e9ef;border-radius:12px;padding:24px}
  h1{font-size:18px;color:#0f2747;margin:0 0 8px}
  p{font-size:14px;color:#6b7689;line-height:1.5}
  code{display:block;background:#0f2747;color:#e0c585;padding:14px;border-radius:8px;word-break:break-all;font-size:13px;margin:12px 0}
  .ok{color:#1f8a5b;font-weight:700}
  .err{color:#c0392b;font-weight:700}
</style></head><body><div class="card">
<h1>${title}</h1>
${body}
${token ? `<code id="t">${token}</code><button onclick="navigator.clipboard.writeText(document.getElementById('t').innerText)">Copy</button>` : ""}
</div></body></html>`;
  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const err = url.searchParams.get("error");
  if (err) return page("Authorization failed", `<p class="err">Google returned: ${err}</p>`);
  if (!code) return page("Missing code", `<p class="err">No authorization code in the callback.</p>`);

  const redirectUri = `${url.origin}/api/drive/oauth-callback`;
  const oauth2 = getOAuthClient(redirectUri);
  try {
    const { tokens } = await oauth2.getToken(code);
    const refresh = tokens.refresh_token;
    if (!refresh) {
      return page(
        "No refresh_token returned",
        `<p>Google didn't return a refresh_token. This usually means this account already granted access before.</p>
         <p>Fix: open <b>myaccount.google.com → Security → Third-party access</b>, remove "OLCC Books", then re-run
         <b>/api/drive/setup-token?secret=…</b>.</p>`,
      );
    }
    return page(
      "✓ Got your refresh token",
      `<p class="ok">Success.</p>
       <p>Copy the token below into Vercel as <b>GOOGLE_DRIVE_REFRESH_TOKEN</b> (Production), then Redeploy.</p>`,
      refresh,
    );
  } catch (e) {
    return page("Token exchange failed", `<p class="err">${(e as Error).message}</p>`);
  }
}
