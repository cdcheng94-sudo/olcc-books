"use client";

import { compressImage } from "@/lib/image";

/**
 * Client helper: compress (if image) → POST to /api/drive/upload, which
 * stores the file on Google Drive, records drive_files, and sets
 * receipt_url on the linked row. Shared by the transaction form, the
 * claim form, and the "Upload receipt" (补传) buttons.
 */
export type UploadReceiptArgs = {
  file: File;
  category: "Receipts" | "Claims" | "Capital";
  linkedTable: "transactions" | "claims";
  linkedId: string;
  dateIso: string;
  party?: string | null;
  docType?: string;
};

export type UploadReceiptResult =
  | { ok: true; webViewLink: string }
  | { ok: false; kind?: string; error: string };

export async function uploadReceiptToDrive(args: UploadReceiptArgs): Promise<UploadReceiptResult> {
  const compressed = await compressImage(args.file);
  const fd = new FormData();
  fd.append("file", compressed, compressed.name);
  fd.append("category", args.category);
  fd.append("linkedTable", args.linkedTable);
  fd.append("linkedId", args.linkedId);
  fd.append("dateIso", args.dateIso);
  if (args.party) fd.append("party", args.party);
  fd.append("docType", args.docType || "receipt");
  try {
    const res = await fetch("/api/drive/upload", { method: "POST", body: fd });
    return (await res.json()) as UploadReceiptResult;
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
