/**
 * Server-side PDF rendering + upload pipeline. React-PDF gives us a
 * stream/buffer; we drop that into the `pdfs` Supabase Storage bucket and
 * return a short-lived signed URL the email layer can attach or the user
 * can click.
 *
 * IMPORTANT: This module pulls in @react-pdf/renderer, which is heavy
 * (it's a React renderer for PDF docs). Only import it from server
 * actions or route handlers — never from a "use client" file or the
 * client bundle balloons by 1MB+.
 */

import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "pdfs";

/**
 * Render any React-PDF Document element to a Buffer, upload to the
 * `pdfs` bucket under the given path, and return a signed URL valid
 * for 7 days plus the storage path for record-keeping.
 *
 * Note: the input is a `<MyComponent ... />` element whose component
 * returns a `<Document>`. React-PDF's `renderToBuffer` annotates its
 * parameter as `ReactElement<DocumentProps>`, but in practice it walks
 * the tree and finds the underlying Document either way — so we cast
 * to satisfy the type checker.
 */
export async function renderAndUploadPDF(
  supabase: SupabaseClient,
  doc: React.ReactElement,
  path: string,
): Promise<{ url: string; path: string }> {
  const buffer = await renderToBuffer(doc as React.ReactElement<DocumentProps>);

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (upErr) throw new Error(`PDF upload failed: ${upErr.message}`);

  const { data, error: urlErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 days
  if (urlErr) throw new Error(`PDF signed URL failed: ${urlErr.message}`);

  return { url: data.signedUrl, path };
}

/**
 * Refresh a signed URL for an existing PDF (used when the previous one
 * expires). Path is the storage object key, e.g. "invoices/INV-0001.pdf".
 */
export async function refreshSignedUrl(supabase: SupabaseClient, path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
