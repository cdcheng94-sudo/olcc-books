/**
 * Google Drive integration (drive.file scope).
 *
 * Receipt photos / PDFs that users upload go here; system-generated PDFs
 * (invoices/receipts) and the logo stay on Supabase Storage.
 *
 * The app authenticates as the "archive account" via a long-lived
 * refresh_token (obtained once via /api/drive/setup-token). With drive.file
 * scope the app can only touch files/folders it created — including the
 * "OLCC Books" root folder, which it self-creates (decision A).
 *
 * This module is server-only — it reads GOOGLE_DRIVE_* secrets.
 * The upload/folder/delete helpers are added in the next step; for now it
 * exposes the OAuth client used by the one-time token-setup routes.
 */

import { google } from "googleapis";

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

/**
 * OAuth2 client. Pass redirectUri for the interactive setup flow; omit it
 * for server-to-server calls that use the stored refresh_token.
 */
export function getOAuthClient(redirectUri?: string) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_DRIVE_CLIENT_ID,
    process.env.GOOGLE_DRIVE_CLIENT_SECRET,
    redirectUri,
  );
}
