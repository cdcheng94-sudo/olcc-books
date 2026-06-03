"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ShareholderRow } from "@/lib/types";

/**
 * Create a shareholder. Used by the inline "+ New shareholder" button in
 * the transaction form (capital_injection / loan_repayment / interest_paid),
 * so the operator never has to leave the form to add a new director.
 */
export async function createShareholder(name: string): Promise<ShareholderRow> {
  const clean = name.trim();
  if (!clean) throw new Error("Shareholder name is required.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shareholders")
    .insert({ name: clean })
    .select()
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/transactions");
  revalidatePath("/capital");
  return data as ShareholderRow;
}
