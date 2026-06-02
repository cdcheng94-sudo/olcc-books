"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES } from "@/lib/categories";
import { advanceDate, FREQUENCIES, type Frequency } from "@/lib/recurring-utils";
import { todayIso } from "@/lib/format";

export type RecurringInput = {
  id?: string;
  name: string;
  payee?: string;
  amount: number;
  category: string;
  frequency: Frequency;
  next_due_date: string;     // YYYY-MM-DD
  remind_days_before?: number;
  status?: "active" | "paused";
};

function validate(input: RecurringInput): RecurringInput {
  if (!input.name?.trim())                                                  throw new Error("Name is required.");
  if (!input.next_due_date || !/^\d{4}-\d{2}-\d{2}$/.test(input.next_due_date)) throw new Error("Valid due date required.");
  if (!FREQUENCIES.includes(input.frequency))                                throw new Error("Invalid frequency.");
  if (!CATEGORIES.expense.includes(input.category as never))                 throw new Error(`Invalid category: ${input.category}`);
  const amt = Number(input.amount);
  if (!isFinite(amt) || amt <= 0)                                            throw new Error("Amount must be > 0.");
  const remind = Number(input.remind_days_before);
  return {
    id:                 input.id,
    name:               input.name.trim(),
    payee:              input.payee?.trim() || undefined,
    amount:             +amt.toFixed(2),
    category:           input.category,
    frequency:          input.frequency,
    next_due_date:      input.next_due_date,
    remind_days_before: isFinite(remind) && remind >= 0 ? remind : 7,
    status:             input.status === "paused" ? "paused" : "active",
  };
}

export async function createRecurring(input: RecurringInput) {
  const c = validate(input);
  const supabase = await createClient();
  const { data, error } = await supabase.from("recurring").insert({
    name: c.name, payee: c.payee ?? null, amount: c.amount, category: c.category,
    frequency: c.frequency, next_due_date: c.next_due_date,
    remind_days_before: c.remind_days_before, status: c.status,
  }).select().single();
  if (error) throw new Error(error.message);
  revalidatePath("/recurring");
  revalidatePath("/dashboard");
  return data;
}

export async function updateRecurring(id: string, input: RecurringInput) {
  const c = validate({ ...input, id });
  const supabase = await createClient();
  const { data, error } = await supabase.from("recurring").update({
    name: c.name, payee: c.payee ?? null, amount: c.amount, category: c.category,
    frequency: c.frequency, next_due_date: c.next_due_date,
    remind_days_before: c.remind_days_before, status: c.status,
  }).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  revalidatePath("/recurring");
  revalidatePath("/dashboard");
  return data;
}

export async function deleteRecurring(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("recurring").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/recurring");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * markRecurringPaid — the heart of the module. Cascade pattern from v1:
 *   1. Insert an expense Transaction (so cash flow is in the ledger)
 *   2. Advance next_due_date by the frequency
 *   3. Stamp last_paid_date = today
 * If step 1 fails we don't advance — owner can retry without losing state.
 */
export async function markRecurringPaid(id: string) {
  const supabase = await createClient();

  const { data: rec, error: e1 } = await supabase
    .from("recurring").select("*").eq("id", id).single();
  if (e1 || !rec) throw new Error("Recurring not found.");

  const today = todayIso();

  const { error: e2 } = await supabase.from("transactions").insert({
    date:          today,
    type:          "expense",
    category:      rec.category,
    amount:        rec.amount,
    party:         rec.payee ?? null,
    note:          `Recurring: ${rec.name}`,
    linked_doc_id: rec.id,
  });
  if (e2) throw new Error("Failed to record expense: " + e2.message);

  const next = advanceDate(rec.next_due_date, rec.frequency as Frequency);

  const { error: e3 } = await supabase.from("recurring").update({
    last_paid_date: today,
    next_due_date:  next,
  }).eq("id", id);
  if (e3) throw new Error("Recorded but failed to advance: " + e3.message);

  revalidatePath("/recurring");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  return { ok: true, next_due_date: next };
}
