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
 * Server-only — reads GOOGLE_DRIVE_* secrets. Never import from a
 * "use client" file.
 */

import { Readable } from "node:stream";
import { google, type drive_v3 } from "googleapis";

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const ROOT_FOLDER_NAME = "OLCC Books";

export type DriveCategory = "Receipts" | "Claims" | "Capital";

export type DriveUploadResult = {
  fileId:      string;
  webViewLink: string;
  folderPath:  string;
};

/** Typed error so callers can branch on the failure kind. */
export type DriveErrorKind = "auth" | "quota" | "network" | "config" | "other";
export class DriveError extends Error {
  kind: DriveErrorKind;
  constructor(kind: DriveErrorKind, message: string) {
    super(message);
    this.kind = kind;
    this.name = "DriveError";
  }
}

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

let _drive: drive_v3.Drive | null = null;
function driveClient(): drive_v3.Drive {
  if (_drive) return _drive;
  const { GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, GOOGLE_DRIVE_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_DRIVE_CLIENT_ID || !GOOGLE_DRIVE_CLIENT_SECRET || !GOOGLE_DRIVE_REFRESH_TOKEN) {
    throw new DriveError("config", "Google Drive env vars are not all set.");
  }
  const auth = getOAuthClient();
  auth.setCredentials({ refresh_token: GOOGLE_DRIVE_REFRESH_TOKEN });
  _drive = google.drive({ version: "v3", auth });
  return _drive;
}

/** Map a raw googleapis error to a DriveErrorKind. */
function classify(e: unknown): DriveErrorKind {
  const err = e as { message?: string; code?: number; response?: { status?: number; data?: { error?: string } } };
  const status = err?.code ?? err?.response?.status;
  const oauthErr = err?.response?.data?.error;
  const msg = (err?.message || "").toLowerCase();
  if (oauthErr === "invalid_grant" || msg.includes("invalid_grant")) return "auth";
  if (status === 401) return "auth";
  if (status === 403 && (msg.includes("quota") || msg.includes("storage"))) return "quota";
  if (msg.includes("quota") || msg.includes("storagequotaexceeded")) return "quota";
  if (status === 429) return "quota";
  if (msg.includes("network") || msg.includes("timeout") || msg.includes("econn") || msg.includes("socket")) return "network";
  return "other";
}

// ---- folder cache (per warm lambda) ----
const folderCache = new Map<string, string>(); // path → folderId

async function findOrCreateFolder(drive: drive_v3.Drive, name: string, parentId?: string): Promise<string> {
  const cacheKey = `${parentId || "root"}/${name}`;
  const cached = folderCache.get(cacheKey);
  if (cached) return cached;

  // Search among files this app created (drive.file scope).
  const parentClause = parentId ? ` and '${parentId}' in parents` : "";
  const q = `mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' and trashed=false${parentClause}`;
  const list = await drive.files.list({ q, fields: "files(id, name)", spaces: "drive", pageSize: 1 });
  const found = list.data.files?.[0]?.id;
  if (found) { folderCache.set(cacheKey, found); return found; }

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId ? { parents: [parentId] } : {}),
    },
    fields: "id",
  });
  const id = created.data.id!;
  folderCache.set(cacheKey, id);
  return id;
}

/** Ensure OLCC Books/{year}/{category}; returns the leaf folder id + path. */
async function ensureFolderPath(drive: drive_v3.Drive, year: number, category: DriveCategory): Promise<{ id: string; path: string }> {
  const root = await findOrCreateFolder(drive, ROOT_FOLDER_NAME);
  const yearF = await findOrCreateFolder(drive, String(year), root);
  const catF  = await findOrCreateFolder(drive, category, yearF);
  return { id: catF, path: `${ROOT_FOLDER_NAME}/${year}/${category}` };
}

export type DriveUploadOptions = {
  file:     Buffer;
  filename: string;
  mimeType: string;
  category: DriveCategory;
  date:     Date;
  _retried?: boolean;
};

export async function uploadToDrive(opts: DriveUploadOptions): Promise<DriveUploadResult> {
  let drive: drive_v3.Drive;
  try { drive = driveClient(); }
  catch (e) { throw e instanceof DriveError ? e : new DriveError("config", String(e)); }

  try {
    const { id: folderId, path } = await ensureFolderPath(drive, opts.date.getFullYear(), opts.category);
    const res = await drive.files.create({
      requestBody: { name: opts.filename, parents: [folderId] },
      media: { mimeType: opts.mimeType, body: Readable.from(opts.file) },
      fields: "id, webViewLink",
    });
    return {
      fileId:      res.data.id!,
      webViewLink: res.data.webViewLink || `https://drive.google.com/file/d/${res.data.id}/view`,
      folderPath:  path,
    };
  } catch (e) {
    const kind = classify(e);
    if (kind === "network" && !opts._retried) {
      return uploadToDrive({ ...opts, _retried: true });   // retry once
    }
    if (kind === "auth")  throw new DriveError("auth",  "Google Drive authorization expired. Re-authorize required.");
    if (kind === "quota") throw new DriveError("quota", "Google Drive storage quota exceeded.");
    throw new DriveError(kind, (e as Error)?.message || "Drive upload failed.");
  }
}

export async function deleteFromDrive(fileId: string): Promise<void> {
  try {
    const drive = driveClient();
    await drive.files.delete({ fileId });
  } catch (e) {
    // Best-effort: a missing/already-deleted file shouldn't break the caller.
    const kind = classify(e);
    if (kind === "auth") throw new DriveError("auth", "Google Drive authorization expired.");
    // swallow 404 / other — the DB row gets removed regardless
  }
}

/** Build "{YYYY-MM-DD}_{type}_{party-slug}_{shortid}.{ext}". */
export function buildFilename(opts: {
  dateIso: string;          // YYYY-MM-DD
  type: string;             // 'receipt' | 'claim' | tx type
  party?: string | null;
  id: string;               // transaction/claim id
  originalName: string;
}): string {
  const slug = (opts.party || "unknown")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 30) || "unknown";
  const ext = (opts.originalName.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "bin";
  const shortid = opts.id.replace(/-/g, "").slice(0, 6);
  return `${opts.dateIso}_${opts.type}_${slug}_${shortid}.${ext}`;
}
