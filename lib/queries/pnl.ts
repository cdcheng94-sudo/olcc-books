/**
 * Profit & Loss over a range of months, one column per month.
 *
 * Same definition of "operating" the dashboard uses, so the two can never
 * disagree: revenue = income; expenses = expense + interest_paid. Shareholder
 * loans, equity, capital expenses and loan repayments are balance-sheet
 * movements and stay out (see PROJECT_OVERVIEW §6).
 *
 * Cash basis: a row counts in the month its date falls in. An annual fee paid
 * up front therefore lands entirely in the month the money arrived.
 *
 * Aggregated in JS over one narrow SELECT — the ledger is small, and reading
 * every operating row also yields the first month with data ("All time").
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** Key used for the interest line, which has no category of its own. */
export const INTEREST_KEY = "interest_paid";

/** Longest range the page will render (5 years of columns). */
const MAX_MONTHS = 60;

export type PnlLine = {
  key: string;        // category string, or INTEREST_KEY
  values: number[];   // one per month in the range
  total: number;
};

export type PnlReport = {
  from: string;                // "YYYY-MM", inclusive
  to: string;                  // "YYYY-MM", inclusive
  months: string[];            // every "YYYY-MM" from..to
  firstMonth: string | null;   // earliest month with any operating row
  income: PnlLine[];           // largest first
  expense: PnlLine[];
  incomeByMonth: number[];
  expenseByMonth: number[];
  netByMonth: number[];
  totals: { income: number; expense: number; net: number };
};

const r2 = (n: number) => +n.toFixed(2);

/** Every "YYYY-MM" from..to inclusive (swapped if reversed, capped at MAX_MONTHS). */
export function monthRange(from: string, to: string): string[] {
  if (from > to) [from, to] = [to, from];
  let [y, m] = from.split("-").map(Number);
  const out: string[] = [];
  while (out.length < MAX_MONTHS) {
    const ym = `${y}-${String(m).padStart(2, "0")}`;
    out.push(ym);
    if (ym === to) break;
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}

export async function getPnl(supabase: SupabaseClient, from: string, to: string): Promise<PnlReport> {
  const { data, error } = await supabase
    .from("transactions")
    .select("date, type, category, amount")
    .in("type", ["income", "expense", "interest_paid"]);
  if (error) throw new Error(error.message);

  const months = monthRange(from, to);
  const col = new Map(months.map((ym, i) => [ym, i]));
  const zeros = () => months.map(() => 0);

  let firstMonth: string | null = null;
  const income = new Map<string, number[]>();
  const expense = new Map<string, number[]>();

  for (const row of data || []) {
    const ym = String(row.date).slice(0, 7);
    if (!firstMonth || ym < firstMonth) firstMonth = ym;
    const i = col.get(ym);
    if (i === undefined) continue;

    const bucket = row.type === "income" ? income : expense;
    const key = row.type === "interest_paid" ? INTEREST_KEY : (row.category || "Uncategorised");
    if (!bucket.has(key)) bucket.set(key, zeros());
    bucket.get(key)![i] += Number(row.amount) || 0;
  }

  const toLines = (map: Map<string, number[]>): PnlLine[] =>
    Array.from(map.entries())
      .map(([key, values]) => ({ key, values: values.map(r2), total: r2(values.reduce((a, b) => a + b, 0)) }))
      .sort((a, b) => b.total - a.total);

  const incomeLines = toLines(income);
  const expenseLines = toLines(expense);
  const sumByMonth = (lines: PnlLine[]) => months.map((_, i) => r2(lines.reduce((a, l) => a + l.values[i], 0)));

  const incomeByMonth = sumByMonth(incomeLines);
  const expenseByMonth = sumByMonth(expenseLines);
  const totalIncome = r2(incomeByMonth.reduce((a, b) => a + b, 0));
  const totalExpense = r2(expenseByMonth.reduce((a, b) => a + b, 0));

  return {
    from: months[0],
    to: months[months.length - 1],
    months,
    firstMonth,
    income: incomeLines,
    expense: expenseLines,
    incomeByMonth,
    expenseByMonth,
    netByMonth: incomeByMonth.map((v, i) => r2(v - expenseByMonth[i])),
    totals: { income: totalIncome, expense: totalExpense, net: r2(totalIncome - totalExpense) },
  };
}
