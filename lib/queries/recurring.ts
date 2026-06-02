import type { SupabaseClient } from "@supabase/supabase-js";
import type { RecurringRow } from "@/lib/types";
import { daysUntilDue, urgencyFor, sortByDueDate, type Urgency } from "@/lib/recurring-utils";

export async function listRecurring(supabase: SupabaseClient): Promise<RecurringRow[]> {
  const { data, error } = await supabase
    .from("recurring")
    .select("*")
    .order("next_due_date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as RecurringRow[];
}

export type RecurringWithUrgency = RecurringRow & {
  days_until_due: number;
  urgency: Urgency;
};

/** Active items only, enriched with urgency, sorted overdue-first. */
export async function recurringDashboard(supabase: SupabaseClient): Promise<RecurringWithUrgency[]> {
  const { data, error } = await supabase
    .from("recurring")
    .select("*")
    .eq("status", "active");
  if (error) throw new Error(error.message);

  const enriched = (data || []).map((r) => {
    const days = daysUntilDue(r.next_due_date);
    return { ...r, days_until_due: days, urgency: urgencyFor(days) } as RecurringWithUrgency;
  });
  return sortByDueDate(enriched);
}
