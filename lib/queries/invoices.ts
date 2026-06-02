/**
 * Server-side queries for the Invoices module. Mirrors the Transactions
 * query layer's style: takes an authed Supabase client, returns typed rows.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { InvoiceRow, InvoiceStatus } from "@/lib/types";

export type InvoiceFilters = {
  status?: InvoiceStatus | "all";
};

export async function listInvoices(
  supabase: SupabaseClient,
  filters: InvoiceFilters = {},
): Promise<InvoiceRow[]> {
  let q = supabase.from("invoices").select("*").order("date", { ascending: false });
  if (filters.status && filters.status !== "all") {
    q = q.eq("status", filters.status);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []) as InvoiceRow[];
}

export async function getInvoice(supabase: SupabaseClient, id: string): Promise<InvoiceRow> {
  const { data, error } = await supabase.from("invoices").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  return data as InvoiceRow;
}
