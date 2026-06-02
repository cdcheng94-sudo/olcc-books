"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, type TransactionType } from "@/lib/categories";

/**
 * Server actions for Transactions CRUD. Called from client components via
 * <form action={...}> or direct invocation. Each one re-validates input
 * server-side (never trust the client), runs the Supabase call against
 * the user's session, and revalidates the cache so pages re-render with
 * fresh data.
 */

export type TxInput = {
  id?: string;
  date: string;             // YYYY-MM-DD
  type: TransactionType;
  category: string;
  amount: number;
  party?: string;
  note?: string;
  receipt_url?: string;
  linked_doc_id?: string;
};

function validate(input: TxInput): TxInput {
  if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("Valid date required.");
  if (input.type !== "income" && input.type !== "expense")    throw new Error("Type must be income or expense.");
  const allowed = input.type === "income" ? CATEGORIES.income : CATEGORIES.expense;
  if (!allowed.includes(input.category as never))             throw new Error(`Invalid category for ${input.type}.`);
  const amt = Number(input.amount);
  if (!isFinite(amt) || amt <= 0)                             throw new Error("Amount must be > 0.");

  return {
    id:            input.id,
    date:          input.date,
    type:          input.type,
    category:      input.category,
    amount:        +amt.toFixed(2),
    party:         input.party?.trim() || undefined,
    note:          input.note?.trim() || undefined,
    receipt_url:   input.receipt_url?.trim() || undefined,
    linked_doc_id: input.linked_doc_id || undefined,
  };
}

export async function createTransaction(input: TxInput) {
  const clean = validate(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      date:          clean.date,
      type:          clean.type,
      category:      clean.category,
      amount:        clean.amount,
      party:         clean.party ?? null,
      note:          clean.note ?? null,
      receipt_url:   clean.receipt_url ?? null,
      linked_doc_id: clean.linked_doc_id ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return data;
}

export async function updateTransaction(id: string, input: TxInput) {
  const clean = validate({ ...input, id });
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .update({
      date:          clean.date,
      type:          clean.type,
      category:      clean.category,
      amount:        clean.amount,
      party:         clean.party ?? null,
      note:          clean.note ?? null,
      receipt_url:   clean.receipt_url ?? null,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return data;
}

export async function deleteTransaction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { ok: true };
}
