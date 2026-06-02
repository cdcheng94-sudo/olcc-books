import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClaimRow, ClaimStatus } from "@/lib/types";

export type ClaimFilters = {
  status?: ClaimStatus | "all";
};

export async function listClaims(
  supabase: SupabaseClient,
  filters: ClaimFilters = {},
): Promise<ClaimRow[]> {
  let q = supabase.from("claims").select("*").order("date", { ascending: false });
  if (filters.status && filters.status !== "all") q = q.eq("status", filters.status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []) as ClaimRow[];
}
