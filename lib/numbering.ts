/**
 * Document numbering helpers. Invoices and receipts both need monotonic
 * sequences like INV-0001, RCP-0001. Counters live in the `settings` table
 * under `next_invoice_seq` / `next_receipt_seq`. We read-then-bump in
 * a server action — low volume means race conditions are theoretical,
 * but if it ever matters we can move this to a Postgres function with
 * SELECT ... FOR UPDATE.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSettings, setSetting } from "@/lib/queries/settings";

type Kind = "invoice" | "receipt";

export async function nextDocumentNumber(supabase: SupabaseClient, kind: Kind): Promise<string> {
  const settings = await getSettings(supabase);
  const prefix = kind === "invoice" ? settings.invoice_prefix : settings.receipt_prefix;
  const seqKey = kind === "invoice" ? "next_invoice_seq" : "next_receipt_seq";
  const seq    = kind === "invoice" ? settings.next_invoice_seq : settings.next_receipt_seq;

  const padded = String(seq).padStart(4, "0");
  const number = `${prefix}-${padded}`;

  // Bump counter so next caller gets seq+1
  await setSetting(supabase, seqKey, seq + 1);
  return number;
}
