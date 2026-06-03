/**
 * Server-side query helpers for the Transactions module. Used by server
 * components (page.tsx) and server actions. Each function takes an
 * already-authed Supabase server client; the caller decides where to
 * obtain it.
 *
 * Filters and aggregations are computed in Postgres where possible —
 * we don't pull "everything" then aggregate in JS.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TransactionRow } from "@/lib/types";
import { isoMonth } from "@/lib/format";

export type TxFilters = {
  yearMonth?: string;        // "YYYY-MM"
  type?: "income" | "expense";
  category?: string;
  includeOlder?: boolean;    // false = default, only this month and later
};

export async function listTransactions(
  supabase: SupabaseClient,
  filters: TxFilters = {},
): Promise<TransactionRow[]> {
  let query = supabase.from("transactions").select("*").order("date", { ascending: false });

  if (filters.yearMonth) {
    // Match exact YYYY-MM
    const start = filters.yearMonth + "-01";
    const [y, m] = filters.yearMonth.split("-").map(Number);
    const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    query = query.gte("date", start).lt("date", nextMonth);
  } else if (!filters.includeOlder) {
    // Default: current month onward
    const ym = isoMonth();
    query = query.gte("date", ym + "-01");
  }

  if (filters.type)     query = query.eq("type", filters.type);
  if (filters.category) query = query.eq("category", filters.category);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []) as TransactionRow[];
}

export type MonthlySummary = {
  income: number;
  expense: number;
  net: number;
  count: number;
};

/**
 * Aggregate income + expense for a given year-month (default: current).
 * Used by Dashboard stat cards.
 */
export async function getMonthlySummary(
  supabase: SupabaseClient,
  yearMonth?: string,
): Promise<MonthlySummary> {
  const ym = yearMonth || isoMonth();
  const [y, m] = ym.split("-").map(Number);
  const start = ym + "-01";
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;

  const { data, error } = await supabase
    .from("transactions")
    .select("type, amount")
    .gte("date", start)
    .lt("date", nextMonth);
  if (error) throw new Error(error.message);

  // P&L (Operating only): expense includes interest_paid; capital_* and
  // loan_repayment do NOT touch the P&L.
  let income = 0, expense = 0;
  for (const row of data || []) {
    const amt = Number(row.amount) || 0;
    if (row.type === "income")        income  += amt;
    if (row.type === "expense")       expense += amt;
    if (row.type === "interest_paid") expense += amt;
  }
  return {
    income:  +income.toFixed(2),
    expense: +expense.toFixed(2),
    net:     +(income - expense).toFixed(2),
    count:   data?.length || 0,
  };
}
