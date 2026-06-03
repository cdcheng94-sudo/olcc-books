/**
 * Capital / Operating dual-pool analytics.
 *
 * Fund pools:
 *   Capital Pool   = Σshareholder_loan + Σcapital_injection − Σcapital_expense − Σloan_repayment
 *   Operating Pool = Σincome − Σexpense − Σinterest_paid
 *   Total          = Capital Pool + Operating Pool
 *
 * Director's Loan Account, per shareholder (LOANS only — equity/股本 is
 * NOT a repayable balance):
 *   Outstanding = Σshareholder_loan − Σloan_repayment   (interest does NOT reduce it)
 *   Interest Received = Σinterest_paid
 *
 * Everything is computed in JS over a narrow SELECT — volumes are tiny.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TransactionRow, ShareholderRow } from "@/lib/types";

export type FundPools = {
  capitalPool:   number;
  operatingPool: number;
  total:         number;
};

type TypeAmount = Pick<TransactionRow, "type" | "amount">;

function sumByType(rows: TypeAmount[]): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const r of rows) acc[r.type] = (acc[r.type] || 0) + (Number(r.amount) || 0);
  return acc;
}

export async function getFundPools(supabase: SupabaseClient): Promise<FundPools> {
  const { data, error } = await supabase.from("transactions").select("type, amount");
  if (error) throw new Error(error.message);
  const s = sumByType((data || []) as TypeAmount[]);

  const capitalPool   = (s.shareholder_loan || 0) + (s.capital_injection || 0) - (s.capital_expense || 0) - (s.loan_repayment || 0);
  const operatingPool = (s.income || 0) - (s.expense || 0) - (s.interest_paid || 0);
  return {
    capitalPool:   +capitalPool.toFixed(2),
    operatingPool: +operatingPool.toFixed(2),
    total:         +(capitalPool + operatingPool).toFixed(2),
  };
}

/**
 * Outstanding loan balance for one shareholder. Used by the
 * over-repayment guard + the inline "current outstanding" hint.
 */
export async function getShareholderOutstanding(supabase: SupabaseClient, shareholderId: string): Promise<number> {
  const { data, error } = await supabase
    .from("transactions")
    .select("type, amount")
    .eq("shareholder_id", shareholderId);
  if (error) throw new Error(error.message);
  let borrowed = 0, repaid = 0;
  for (const r of (data || []) as TypeAmount[]) {
    if (r.type === "shareholder_loan") borrowed += Number(r.amount) || 0;   // equity excluded
    if (r.type === "loan_repayment")   repaid   += Number(r.amount) || 0;
  }
  return +(borrowed - repaid).toFixed(2);
}

export type ShareholderSummary = {
  id:               string;
  name:             string;
  totalBorrowed:    number;       // Σshareholder_loan (loans only, not equity)
  equity:           number;       // Σcapital_injection (paid-up capital)
  totalRepaid:      number;
  interestReceived: number;
  outstanding:      number;       // totalBorrowed − totalRepaid
};

export async function getShareholderSummaries(supabase: SupabaseClient): Promise<ShareholderSummary[]> {
  const [{ data: shs, error: e1 }, { data: txs, error: e2 }] = await Promise.all([
    supabase.from("shareholders").select("*").order("created_at", { ascending: true }),
    supabase.from("transactions").select("type, amount, shareholder_id"),
  ]);
  if (e1) throw new Error(e1.message);
  if (e2) throw new Error(e2.message);

  const shareholders = (shs || []) as ShareholderRow[];
  const byId = new Map<string, ShareholderSummary>(
    shareholders.map((s) => [s.id, {
      id: s.id, name: s.name, totalBorrowed: 0, equity: 0, totalRepaid: 0, interestReceived: 0, outstanding: 0,
    }]),
  );

  for (const t of (txs || []) as Array<TypeAmount & { shareholder_id: string | null }>) {
    if (!t.shareholder_id) continue;
    const row = byId.get(t.shareholder_id);
    if (!row) continue;
    const amt = Number(t.amount) || 0;
    if (t.type === "shareholder_loan")  row.totalBorrowed    += amt;   // loans only
    if (t.type === "capital_injection") row.equity           += amt;   // equity / 股本
    if (t.type === "loan_repayment")    row.totalRepaid      += amt;
    if (t.type === "interest_paid")     row.interestReceived += amt;
  }

  for (const row of byId.values()) {
    row.totalBorrowed    = +row.totalBorrowed.toFixed(2);
    row.equity           = +row.equity.toFixed(2);
    row.totalRepaid      = +row.totalRepaid.toFixed(2);
    row.interestReceived = +row.interestReceived.toFixed(2);
    row.outstanding      = +(row.totalBorrowed - row.totalRepaid).toFixed(2);
  }
  return Array.from(byId.values());
}

export type CapitalTotals = {
  totalBorrowed: number;
  totalRepaid:   number;
  outstanding:   number;
};

export async function getCapitalTotals(supabase: SupabaseClient): Promise<CapitalTotals> {
  const { data, error } = await supabase.from("transactions").select("type, amount");
  if (error) throw new Error(error.message);
  const s = sumByType((data || []) as TypeAmount[]);
  const totalBorrowed = s.shareholder_loan || 0;   // loans only, not equity
  const totalRepaid   = s.loan_repayment || 0;
  return {
    totalBorrowed: +totalBorrowed.toFixed(2),
    totalRepaid:   +totalRepaid.toFixed(2),
    outstanding:   +(totalBorrowed - totalRepaid).toFixed(2),
  };
}

/** Rows of one type, newest first, with shareholder name joined in. */
export async function listTransactionsByType(
  supabase: SupabaseClient,
  type: TransactionRow["type"],
): Promise<Array<TransactionRow & { shareholder_name: string | null }>> {
  const { data, error } = await supabase
    .from("transactions")
    .select("*, shareholders(name)")
    .eq("type", type)
    .order("date", { ascending: false });
  if (error) throw new Error(error.message);
  // Supabase returns the joined relation as a nested object; flatten the name.
  return (data || []).map((r: TransactionRow & { shareholders?: { name: string } | null }) => ({
    ...r,
    shareholder_name: r.shareholders?.name ?? null,
  })) as Array<TransactionRow & { shareholder_name: string | null }>;
}
