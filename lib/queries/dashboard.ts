/**
 * Dashboard analytics queries. Three pieces of data the Overview
 * needs beyond the stat cards + reminder lists:
 *
 *   - 6-month income/expense trend  →  bar chart
 *   - This-month expense by category →  pie chart
 *   - Last 8 transactions            →  recent list
 *
 * All aggregations done in JS over a narrow SELECT — volumes are
 * small enough that a single round-trip per chart is fine.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TransactionRow } from "@/lib/types";
import { isoMonth } from "@/lib/format";

// ---------- 6-month trend ----------

export type MonthlyTrendPoint = {
  month: string;     // "YYYY-MM"
  label: string;     // "May" / "Jun" — short for chart x-axis
  income: number;
  expense: number;
};

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export async function getMonthlyTrend(
  supabase: SupabaseClient,
  monthsBack = 6,
): Promise<MonthlyTrendPoint[]> {
  // Build the list of YYYY-MM keys we want, ending at current month.
  const now = new Date();
  const buckets: MonthlyTrendPoint[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    buckets.push({
      month: `${y}-${String(m).padStart(2, "0")}`,
      label: MONTH_LABELS[d.getMonth()],
      income: 0,
      expense: 0,
    });
  }
  const startIso = buckets[0].month + "-01";

  const { data, error } = await supabase
    .from("transactions")
    .select("date, type, amount")
    .gte("date", startIso);
  if (error) throw new Error(error.message);

  const idx = new Map(buckets.map((b, i) => [b.month, i]));
  for (const row of data || []) {
    const ym = String(row.date).slice(0, 7);
    const i = idx.get(ym);
    if (i === undefined) continue;
    const amt = Number(row.amount) || 0;
    if (row.type === "income")  buckets[i].income  += amt;
    if (row.type === "expense") buckets[i].expense += amt;
  }
  // Round once at the end so chart tooltips aren't 1234.0000000001
  for (const b of buckets) {
    b.income  = +b.income.toFixed(2);
    b.expense = +b.expense.toFixed(2);
  }
  return buckets;
}

// ---------- category breakdown ----------

export type CategorySlice = {
  category: string;
  amount: number;
};

export async function getCategoryBreakdown(
  supabase: SupabaseClient,
  yearMonth?: string,
): Promise<CategorySlice[]> {
  const ym = yearMonth || isoMonth();
  const [y, m] = ym.split("-").map(Number);
  const start = ym + "-01";
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;

  const { data, error } = await supabase
    .from("transactions")
    .select("category, amount")
    .eq("type", "expense")
    .gte("date", start)
    .lt("date", nextMonth);
  if (error) throw new Error(error.message);

  const totals = new Map<string, number>();
  for (const row of data || []) {
    const cur = totals.get(row.category) || 0;
    totals.set(row.category, cur + (Number(row.amount) || 0));
  }
  return Array.from(totals.entries())
    .map(([category, amount]) => ({ category, amount: +amount.toFixed(2) }))
    .sort((a, b) => b.amount - a.amount);
}

// ---------- recent transactions ----------

export async function getRecentTransactions(
  supabase: SupabaseClient,
  limit = 8,
): Promise<TransactionRow[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data || []) as TransactionRow[];
}
