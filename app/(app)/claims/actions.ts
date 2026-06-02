"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CLAIM_CATEGORIES } from "@/lib/categories";
import type { ClaimRow, ClaimStatus } from "@/lib/types";

/**
 * Employee reimbursement workflow: pending → approved → paid.
 * Marking a claim "paid" cascades an expense Transaction so the books
 * reflect the cash going out, with linked_doc_id pointing back at the
 * claim for traceability.
 */

export type ClaimInput = {
  date:         string;
  claimant:     string;
  item_desc:    string;
  amount:       number;
  category:     string;
  receipt_url?: string;
  note?:        string;
};

function validate(input: ClaimInput) {
  if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("Valid date required.");
  if (!input.claimant?.trim())  throw new Error("Claimant required.");
  if (!input.item_desc?.trim()) throw new Error("Item description required.");
  if (!isFinite(input.amount) || input.amount <= 0) throw new Error("Amount must be > 0.");
  if (!CLAIM_CATEGORIES.includes(input.category as never)) {
    throw new Error(`Unknown category: ${input.category}`);
  }
}

export async function createClaim(input: ClaimInput): Promise<ClaimRow> {
  validate(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("claims")
    .insert({
      date:        input.date,
      claimant:    input.claimant.trim(),
      item_desc:   input.item_desc.trim(),
      amount:      +input.amount.toFixed(2),
      category:    input.category,
      receipt_url: input.receipt_url?.trim() || null,
      note:        input.note?.trim() || null,
      status:      "pending",
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/claims");
  return data as ClaimRow;
}

export async function updateClaim(id: string, input: ClaimInput): Promise<ClaimRow> {
  validate(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("claims")
    .update({
      date:        input.date,
      claimant:    input.claimant.trim(),
      item_desc:   input.item_desc.trim(),
      amount:      +input.amount.toFixed(2),
      category:    input.category,
      receipt_url: input.receipt_url?.trim() || null,
      note:        input.note?.trim() || null,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/claims");
  return data as ClaimRow;
}

export async function deleteClaim(id: string) {
  const supabase = await createClient();
  // If a transaction was cascaded (paid claim), remove that too.
  await supabase.from("transactions").delete().eq("linked_doc_id", id);
  const { error } = await supabase.from("claims").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/claims");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function setClaimStatus(id: string, status: ClaimStatus) {
  const supabase = await createClient();
  const patch: Record<string, unknown> = { status };
  if (status === "paid") patch.paid_date = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase.from("claims").update(patch).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  revalidatePath("/claims");
  return data as ClaimRow;
}

/**
 * Approve a pending claim. Pure status change — no cascade yet.
 */
export async function approveClaim(id: string) {
  const supabase = await createClient();
  const { data: claim, error: getErr } = await supabase.from("claims").select("*").eq("id", id).single();
  if (getErr) throw new Error(getErr.message);
  if ((claim as ClaimRow).status !== "pending") {
    throw new Error(`Cannot approve a claim that's already ${(claim as ClaimRow).status}.`);
  }
  return await setClaimStatus(id, "approved");
}

/**
 * Mark an approved claim paid → cascade expense Transaction.
 *   - category is always "Other Expense" (claim category lives in the note)
 *   - linked_doc_id back-references the claim
 */
export async function markClaimPaid(id: string) {
  const supabase = await createClient();
  const { data: claim, error: getErr } = await supabase.from("claims").select("*").eq("id", id).single();
  if (getErr) throw new Error(getErr.message);
  const c = claim as ClaimRow;
  if (c.status !== "approved") throw new Error("Approve the claim first before marking it paid.");

  const today = new Date().toISOString().slice(0, 10);

  // 1. Cascade transaction
  const { error: txErr } = await supabase.from("transactions").insert({
    date:          today,
    type:          "expense",
    category:      "Other Expense",
    amount:        c.amount,
    party:         c.claimant,
    note:          `Claim: ${c.item_desc} (${c.category})`,
    linked_doc_id: c.id,
  });
  if (txErr) throw new Error(`Cascade failed: ${txErr.message}`);

  // 2. Flip status + stamp paid_date
  await supabase.from("claims").update({ status: "paid", paid_date: today }).eq("id", id);

  revalidatePath("/claims");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { ok: true };
}
