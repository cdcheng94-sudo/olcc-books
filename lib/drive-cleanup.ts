/**
 * Server helper: when a transaction/claim is deleted, remove its receipt
 * files from Google Drive and the drive_files rows. Best-effort — a Drive
 * failure must NOT block the DB delete.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteFromDrive } from "@/lib/drive";

export async function deleteLinkedDriveFiles(
  supabase: SupabaseClient,
  linkedTable: "transactions" | "claims",
  linkedId: string,
): Promise<void> {
  const { data } = await supabase
    .from("drive_files")
    .select("drive_file_id")
    .eq("linked_table", linkedTable)
    .eq("linked_id", linkedId);

  for (const row of data || []) {
    try { await deleteFromDrive(row.drive_file_id); } catch { /* best-effort */ }
  }
  await supabase.from("drive_files").delete().eq("linked_table", linkedTable).eq("linked_id", linkedId);
}
