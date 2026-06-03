"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  CATEGORIES,
  LOAN_TYPES,
  CAPITAL_CATEGORIES,
  requiresShareholder,
  type TransactionType,
} from "@/lib/categories";
import { getShareholderOutstanding } from "@/lib/queries/capital";

/**
 * Server actions for Transactions CRUD across all 6 types
 * (income / expense / capital_injection / capital_expense /
 *  loan_repayment / interest_paid).
 *
 * Validation is per-type:
 *   - income / expense       → category from CATEGORIES
 *   - capital_expense        → category from CAPITAL_CATEGORIES (key)
 *   - capital_injection      → shareholder_id + loan_type (+ optional rate)
 *   - loan_repayment         → shareholder_id, guarded against over-repayment
 *   - interest_paid          → shareholder_id (period text goes in note)
 */

export type TxInput = {
  id?: string;
  date: string;             // YYYY-MM-DD
  type: TransactionType;
  category?: string | null;
  amount: number;
  party?: string;
  note?: string;
  receipt_url?: string;
  linked_doc_id?: string;
  shareholder_id?: string;
  loan_type?: string;
  interest_rate?: number;
};

type CleanTx = {
  date: string;
  type: TransactionType;
  category: string | null;
  amount: number;
  party: string | null;
  note: string | null;
  receipt_url: string | null;
  linked_doc_id: string | null;
  shareholder_id: string | null;
  loan_type: string | null;
  interest_rate: number;
};

function validate(input: TxInput): CleanTx {
  if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("Valid date required.");
  const amt = Number(input.amount);
  if (!isFinite(amt) || amt <= 0) throw new Error("Amount must be > 0.");

  let category: string | null = null;
  let shareholder_id: string | null = null;
  let loan_type: string | null = null;
  let interest_rate = 0;

  switch (input.type) {
    case "income":
    case "expense": {
      const allowed = input.type === "income" ? CATEGORIES.income : CATEGORIES.expense;
      if (!input.category || !allowed.includes(input.category as never)) {
        throw new Error(`Invalid category for ${input.type}.`);
      }
      category = input.category;
      break;
    }
    case "capital_expense": {
      if (!input.category || !CAPITAL_CATEGORIES.includes(input.category as never)) {
        throw new Error("Choose a capital expense category.");
      }
      category = input.category;
      break;
    }
    case "capital_injection": {
      if (!input.shareholder_id) throw new Error("Shareholder is required for a capital injection.");
      shareholder_id = input.shareholder_id;
      loan_type = input.loan_type && LOAN_TYPES.includes(input.loan_type as never) ? input.loan_type : "director_loan";
      const r = Number(input.interest_rate);
      interest_rate = isFinite(r) && r >= 0 ? +r.toFixed(2) : 0;
      break;
    }
    case "loan_repayment":
    case "interest_paid": {
      if (!input.shareholder_id) throw new Error("Shareholder is required.");
      shareholder_id = input.shareholder_id;
      break;
    }
    default:
      throw new Error(`Unknown transaction type: ${input.type}`);
  }

  // Belt-and-braces: these types must carry a shareholder.
  if (requiresShareholder(input.type) && !shareholder_id) {
    throw new Error("Shareholder is required for this type.");
  }

  return {
    date:          input.date,
    type:          input.type,
    category,
    amount:        +amt.toFixed(2),
    party:         input.party?.trim() || null,
    note:          input.note?.trim() || null,
    receipt_url:   input.receipt_url?.trim() || null,
    linked_doc_id: input.linked_doc_id || null,
    shareholder_id,
    loan_type,
    interest_rate,
  };
}

export async function createTransaction(input: TxInput) {
  const clean = validate(input);
  const supabase = await createClient();

  // Over-repayment guard: a loan_repayment can't exceed the shareholder's
  // current outstanding balance (enforces "loan in before repayment out").
  if (clean.type === "loan_repayment" && clean.shareholder_id) {
    const outstanding = await getShareholderOutstanding(supabase, clean.shareholder_id);
    if (clean.amount > outstanding + 0.001) {
      throw new Error(`Repayment ${clean.amount.toFixed(2)} exceeds the shareholder's outstanding balance of ${outstanding.toFixed(2)}.`);
    }
  }

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      date:           clean.date,
      type:           clean.type,
      category:       clean.category,
      amount:         clean.amount,
      party:          clean.party,
      note:           clean.note,
      receipt_url:    clean.receipt_url,
      linked_doc_id:  clean.linked_doc_id,
      shareholder_id: clean.shareholder_id,
      loan_type:      clean.loan_type,
      interest_rate:  clean.interest_rate,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/capital");
  return data;
}

export async function updateTransaction(id: string, input: TxInput) {
  const clean = validate({ ...input, id });
  const supabase = await createClient();

  if (clean.type === "loan_repayment" && clean.shareholder_id) {
    // Exclude the row being edited from the outstanding calc.
    const outstanding = await getShareholderOutstanding(supabase, clean.shareholder_id);
    const { data: prev } = await supabase.from("transactions").select("type, amount, shareholder_id").eq("id", id).single();
    const prevContribution = (prev && prev.type === "loan_repayment" && prev.shareholder_id === clean.shareholder_id)
      ? Number(prev.amount) || 0 : 0;
    const effectiveOutstanding = outstanding + prevContribution;
    if (clean.amount > effectiveOutstanding + 0.001) {
      throw new Error(`Repayment ${clean.amount.toFixed(2)} exceeds the shareholder's outstanding balance of ${effectiveOutstanding.toFixed(2)}.`);
    }
  }

  const { data, error } = await supabase
    .from("transactions")
    .update({
      date:           clean.date,
      type:           clean.type,
      category:       clean.category,
      amount:         clean.amount,
      party:          clean.party,
      note:           clean.note,
      receipt_url:    clean.receipt_url,
      shareholder_id: clean.shareholder_id,
      loan_type:      clean.loan_type,
      interest_rate:  clean.interest_rate,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/capital");
  return data;
}

export async function deleteTransaction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/capital");
  return { ok: true };
}
