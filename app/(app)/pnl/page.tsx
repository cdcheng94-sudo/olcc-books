import { createClient } from "@/lib/supabase/server";
import { isoMonth } from "@/lib/format";
import { getPnl } from "@/lib/queries/pnl";
import { PnlClient } from "./PnlClient";

const YM = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * /pnl — READ-ONLY profit & loss, one column per month (?from=2026-01&to=2026-10).
 * Defaults to this year so far. All writes happen in /transactions.
 */
export default async function PnlPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const thisMonth = isoMonth();
  const to   = sp.to   && YM.test(sp.to)   ? sp.to   : thisMonth;
  const from = sp.from && YM.test(sp.from) ? sp.from : `${thisMonth.slice(0, 4)}-01`;

  const supabase = await createClient();
  const report = await getPnl(supabase, from, to);
  return <PnlClient report={report} thisMonth={thisMonth} />;
}
