/**
 * Queries for the allowed_emails whitelist — gates who can sign in.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AllowedEmailRow } from "@/lib/types";

export async function listAllowedEmails(supabase: SupabaseClient): Promise<AllowedEmailRow[]> {
  const { data, error } = await supabase
    .from("allowed_emails")
    .select("*")
    .order("added_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as AllowedEmailRow[];
}
