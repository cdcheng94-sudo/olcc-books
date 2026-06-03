import { createClient } from "@/lib/supabase/server";
import {
  getCapitalTotals,
  getShareholderSummaries,
  listTransactionsByType,
} from "@/lib/queries/capital";
import { CapitalClient } from "./CapitalClient";

/**
 * /capital — READ-ONLY view over the Capital Pool side of the books.
 * All writes happen in /transactions; this page just aggregates.
 */
export default async function CapitalPage() {
  const supabase = await createClient();
  const [totals, byShareholder, shareholderLoans, capitalInjections, repayments, capitalExpenses, interestPaid] = await Promise.all([
    getCapitalTotals(supabase),
    getShareholderSummaries(supabase),
    listTransactionsByType(supabase, "shareholder_loan"),
    listTransactionsByType(supabase, "capital_injection"),
    listTransactionsByType(supabase, "loan_repayment"),
    listTransactionsByType(supabase, "capital_expense"),
    listTransactionsByType(supabase, "interest_paid"),
  ]);

  return (
    <CapitalClient
      totals={totals}
      byShareholder={byShareholder}
      shareholderLoans={shareholderLoans}
      capitalInjections={capitalInjections}
      repayments={repayments}
      capitalExpenses={capitalExpenses}
      interestPaid={interestPaid}
    />
  );
}
