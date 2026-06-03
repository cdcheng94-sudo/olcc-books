/**
 * Lightweight count of items needing attention — drives the TopBar bell
 * badge. Counts active subscriptions (customers owe us) + active recurring
 * (we owe vendors) that are inside their reminder window
 * (days_until_due <= remind_days_before), which is exactly what the daily
 * reminder cron acts on.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { daysUntilDue } from "@/lib/recurring-utils";

export async function getReminderCount(supabase: SupabaseClient): Promise<number> {
  const [{ data: subs }, { data: rec }] = await Promise.all([
    supabase.from("subscriptions").select("next_charge_date, remind_days_before, status").eq("status", "active"),
    supabase.from("recurring").select("next_due_date, remind_days_before, status").eq("status", "active"),
  ]);

  let count = 0;
  for (const s of subs || []) {
    if (daysUntilDue(s.next_charge_date) <= (s.remind_days_before ?? 7)) count++;
  }
  for (const r of rec || []) {
    if (daysUntilDue(r.next_due_date) <= (r.remind_days_before ?? 7)) count++;
  }
  return count;
}
