import { createClient } from "@/lib/supabase/server";
import { listTransactions } from "@/lib/queries/transactions";
import { listShareholders } from "@/lib/queries/shareholders";
import { getShareholderSummaries } from "@/lib/queries/capital";
import { isoMonth } from "@/lib/format";
import { TransactionsClient } from "./TransactionsClient";

export default async function TransactionsPage() {
  const supabase = await createClient();
  const [initialRows, shareholders, summaries] = await Promise.all([
    listTransactions(supabase, { yearMonth: isoMonth() }),
    listShareholders(supabase),
    getShareholderSummaries(supabase),
  ]);

  const outstandingMap   = Object.fromEntries(summaries.map((s) => [s.id, s.outstanding]));
  const shareholderNames = Object.fromEntries(shareholders.map((s) => [s.id, s.name]));

  return (
    <TransactionsClient
      initialRows={initialRows}
      shareholders={shareholders}
      outstandingMap={outstandingMap}
      shareholderNames={shareholderNames}
    />
  );
}
