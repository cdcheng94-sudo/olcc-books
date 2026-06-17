import type { SupabaseClient } from "@supabase/supabase-js";
import type { SubscriptionRow, CheckInRow } from "@/lib/types";
import { daysUntilDue, urgencyFor, type Urgency } from "@/lib/recurring-utils";

/**
 * Customer-care queries. Anchored on active subscriptions — each is a
 * customer relationship we want to nurture. We enrich every subscription
 * with how soon its next check-in is due (so the team can chase the most
 * overdue first) and when it was last contacted.
 */

export type CareItem = SubscriptionRow & {
  days_until_checkin: number | null;   // null = no check-in scheduled
  checkin_urgency: Urgency | null;
  last_checkin_date: string | null;
  payment_overdue: boolean;            // next_charge_date already passed
};

async function buildCareItems(supabase: SupabaseClient): Promise<CareItem[]> {
  const { data: subs, error } = await supabase
    .from("subscriptions").select("*").eq("status", "active");
  if (error) throw new Error(error.message);

  // Latest check-in date per subscription (rows come newest-first).
  const { data: checkins } = await supabase
    .from("check_ins").select("subscription_id, date").order("date", { ascending: false });
  const lastBySub = new Map<string, string>();
  for (const c of checkins || []) {
    if (!lastBySub.has(c.subscription_id)) lastBySub.set(c.subscription_id, c.date);
  }

  const items = (subs || []).map((s) => {
    const days = s.next_checkin_date != null ? daysUntilDue(s.next_checkin_date) : null;
    return {
      ...s,
      days_until_checkin: days,
      checkin_urgency: days != null ? urgencyFor(days) : null,
      last_checkin_date: lastBySub.get(s.id) ?? null,
      payment_overdue: daysUntilDue(s.next_charge_date) < 0,
    } as CareItem;
  });

  // Soonest/overdue check-ins first; unscheduled (null) sink to the bottom.
  return items.sort((a, b) => {
    if (a.days_until_checkin == null && b.days_until_checkin == null) return 0;
    if (a.days_until_checkin == null) return 1;
    if (b.days_until_checkin == null) return -1;
    return a.days_until_checkin - b.days_until_checkin;
  });
}

export async function listCareItems(supabase: SupabaseClient): Promise<CareItem[]> {
  return buildCareItems(supabase);
}

/** Customers whose check-in is due today or overdue — for the dashboard card. */
export async function careDashboard(supabase: SupabaseClient): Promise<CareItem[]> {
  const all = await buildCareItems(supabase);
  return all.filter((c) => c.days_until_checkin != null && c.days_until_checkin <= 0);
}

export async function listCheckIns(supabase: SupabaseClient, subscriptionId: string): Promise<CheckInRow[]> {
  const { data, error } = await supabase
    .from("check_ins").select("*").eq("subscription_id", subscriptionId).order("date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as CheckInRow[];
}
