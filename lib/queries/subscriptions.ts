import type { SupabaseClient } from "@supabase/supabase-js";
import type { SubscriptionRow } from "@/lib/types";
import { daysUntilDue, urgencyFor, sortByDueDate, type Urgency } from "@/lib/recurring-utils";

export async function listSubscriptions(supabase: SupabaseClient): Promise<SubscriptionRow[]> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .order("next_charge_date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as SubscriptionRow[];
}

export type SubscriptionWithUrgency = SubscriptionRow & {
  days_until_due: number;
  urgency: Urgency;
};

/** Active items only, enriched with urgency, sorted overdue-first. */
export async function subscriptionsDashboard(supabase: SupabaseClient): Promise<SubscriptionWithUrgency[]> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("status", "active");
  if (error) throw new Error(error.message);

  const enriched = (data || []).map((r) => {
    const days = daysUntilDue(r.next_charge_date);
    return { ...r, days_until_due: days, urgency: urgencyFor(days) } as SubscriptionWithUrgency;
  });
  return sortByDueDate(enriched);
}
