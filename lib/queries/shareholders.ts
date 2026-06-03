/**
 * Shareholders — the subjects of the Director's Loan Account (股东往来账).
 * Read helper for dropdowns + the /capital By-Shareholder view.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShareholderRow } from "@/lib/types";

export async function listShareholders(supabase: SupabaseClient): Promise<ShareholderRow[]> {
  const { data, error } = await supabase
    .from("shareholders")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as ShareholderRow[];
}
