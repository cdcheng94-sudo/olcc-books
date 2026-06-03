import { createClient } from "@/lib/supabase/server";
import { getMonthlySummary } from "@/lib/queries/transactions";
import { recurringDashboard } from "@/lib/queries/recurring";
import { subscriptionsDashboard } from "@/lib/queries/subscriptions";
import { getFundPools } from "@/lib/queries/capital";
import {
  getMonthlyTrend,
  getCategoryBreakdown,
  getRecentTransactions,
} from "@/lib/queries/dashboard";
import { DashboardClient } from "./DashboardClient";

/**
 * Dashboard — server component. Fetches every panel's data in parallel
 * so the page paints in one round trip. Client component then handles
 * layout, language switching, and any future interactivity.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const [summary, toPay, toCollect, trend, byCategory, recent, pools] = await Promise.all([
    getMonthlySummary(supabase),
    recurringDashboard(supabase),
    subscriptionsDashboard(supabase),
    getMonthlyTrend(supabase, 6),
    getCategoryBreakdown(supabase),
    getRecentTransactions(supabase, 8),
    getFundPools(supabase),
  ]);
  return (
    <DashboardClient
      summary={summary}
      toPay={toPay}
      toCollect={toCollect}
      trend={trend}
      byCategory={byCategory}
      recent={recent}
      pools={pools}
    />
  );
}
