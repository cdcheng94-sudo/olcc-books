import { createClient } from "@/lib/supabase/server";
import { listTransactions } from "@/lib/queries/transactions";
import { isoMonth } from "@/lib/format";
import { TransactionsClient } from "./TransactionsClient";

/**
 * Transactions page — server component. Loads the initial slice of rows
 * for the current month and hands them to TransactionsClient, which
 * manages filters / modal state / mutation refresh.
 */
export default async function TransactionsPage() {
  const supabase = await createClient();
  const initialRows = await listTransactions(supabase, { yearMonth: isoMonth() });
  return <TransactionsClient initialRows={initialRows} />;
}
