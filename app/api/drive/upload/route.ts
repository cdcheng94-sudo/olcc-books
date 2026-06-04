import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { uploadToDrive, deleteFromDrive, buildFilename, DriveError, type DriveCategory } from "@/lib/drive";
import { sendDriveAlertEmail } from "@/lib/email";

/**
 * Upload one receipt file to Google Drive and link it to a transaction/claim.
 *
 * multipart/form-data fields:
 *   file         — the receipt image/pdf
 *   category     — 'Receipts' | 'Claims' | 'Capital'
 *   linkedTable  — 'transactions' | 'claims'
 *   linkedId     — the row id
 *   dateIso      — YYYY-MM-DD (used for folder year + filename)
 *   party        — optional, for the filename slug
 *   docType      — optional, for the filename ('receipt' | 'claim' | tx type)
 *
 * On success: writes a drive_files row, sets {linkedTable}.receipt_url to the
 * webViewLink, returns { ok, webViewLink }.
 *
 * Drive failures DON'T 500 — they return { ok:false, kind } so the client can
 * show "upload failed, retry later" while the row itself stays saved. auth/
 * quota failures also email the owner (debounced 6h).
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALLOWED_TABLES = new Set(["transactions", "claims"]);
const ALLOWED_CATS: DriveCategory[] = ["Receipts", "Claims", "Capital"];

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  let form: FormData;
  try { form = await request.formData(); }
  catch (e) { return NextResponse.json({ ok: false, error: `Bad form: ${(e as Error).message}` }, { status: 400 }); }

  const file        = form.get("file") as File | null;
  const category    = String(form.get("category") || "Receipts") as DriveCategory;
  const linkedTable = String(form.get("linkedTable") || "");
  const linkedId    = String(form.get("linkedId") || "");
  const dateIso     = String(form.get("dateIso") || new Date().toISOString().slice(0, 10));
  const party       = (form.get("party") as string) || null;
  const docType     = String(form.get("docType") || "receipt");

  if (!file || file.size === 0)             return NextResponse.json({ ok: false, error: "No file" }, { status: 400 });
  if (file.size > 8 * 1024 * 1024)          return NextResponse.json({ ok: false, error: "File too large (max 8 MB)" }, { status: 400 });
  if (!ALLOWED_TABLES.has(linkedTable))     return NextResponse.json({ ok: false, error: "Bad linkedTable" }, { status: 400 });
  if (!linkedId)                            return NextResponse.json({ ok: false, error: "Missing linkedId" }, { status: 400 });
  if (!ALLOWED_CATS.includes(category))     return NextResponse.json({ ok: false, error: "Bad category" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = buildFilename({ dateIso, type: docType, party, id: linkedId, originalName: file.name });

  try {
    const result = await uploadToDrive({
      file: buffer,
      filename,
      mimeType: file.type || "application/octet-stream",
      category,
      date: new Date(dateIso + "T00:00:00"),
    });

    // record metadata
    await supabase.from("drive_files").insert({
      drive_file_id: result.fileId,
      web_view_link: result.webViewLink,
      filename,
      mime_type: file.type || null,
      size_bytes: file.size,
      folder_path: result.folderPath,
      linked_table: linkedTable,
      linked_id: linkedId,
      uploaded_by: user.email || null,
    });

    // link onto the row
    const { error: upErr } = await supabase.from(linkedTable).update({ receipt_url: result.webViewLink }).eq("id", linkedId);
    if (upErr) {
      // row update failed — roll back the Drive file so we don't orphan it
      await deleteFromDrive(result.fileId);
      return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, webViewLink: result.webViewLink });
  } catch (e) {
    const kind = e instanceof DriveError ? e.kind : "other";
    if (kind === "auth" || kind === "quota") {
      await maybeAlertOwner(supabase, kind);
    }
    return NextResponse.json({ ok: false, kind, error: (e as Error).message }, { status: 200 });
  }
}

/** Email the owner at most once per 6h per failure kind. */
async function maybeAlertOwner(supabase: Awaited<ReturnType<typeof createClient>>, kind: "auth" | "quota") {
  const to = process.env.GOOGLE_DRIVE_OWNER_EMAIL;
  if (!to) return;
  const key = `drive_alert_${kind}_at`;
  const { data } = await supabase.from("settings").select("value").eq("key", key).maybeSingle();
  const last = data?.value ? Number(data.value) : 0;
  const now = Date.now();
  if (now - last < 6 * 60 * 60 * 1000) return;   // within 6h, skip
  try {
    await sendDriveAlertEmail({ to, kind });
    await supabase.from("settings").upsert({ key, value: String(now) }, { onConflict: "key" });
  } catch { /* alert is best-effort */ }
}
