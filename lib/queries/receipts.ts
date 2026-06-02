/**
 * Server-side queries for the Receipts module.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReceiptRow } from "@/lib/types";

export async function listReceipts(supabase: SupabaseClient): Promise<ReceiptRow[]> {
  const { data, error } = await supabase
    .from("receipts")
    .select("*")
    .order("date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as ReceiptRow[];
}

export async function getReceipt(supabase: SupabaseClient, id: string): Promise<ReceiptRow> {
  const { data, error } = await supabase.from("receipts").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  return data as ReceiptRow;
}
