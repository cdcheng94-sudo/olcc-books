"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { addDays } from "@/lib/recurring-utils";
import { CHECKIN_CHANNELS, CHECKIN_HEALTHS, CHECKIN_INTERVALS } from "@/lib/categories";

/**
 * logCheckIn — record an after-sales 客户关怀 touch with a customer.
 * Inserts a check_ins row (with the customer's feedback) and advances the
 * subscription's next_checkin_date by the chosen interval, plus updates
 * its current health flag.
 */

export type CheckInInput = {
  subscription_id: string;
  date: string;                 // YYYY-MM-DD
  channel: string;
  health: string;
  feedback?: string;
  next_interval_days: number;
};

export async function logCheckIn(input: CheckInInput) {
  if (!input.subscription_id) throw new Error("Subscription is required.");
  if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("Valid date required.");
  const channel  = (CHECKIN_CHANNELS as readonly string[]).includes(input.channel) ? input.channel : "other";
  const health   = (CHECKIN_HEALTHS as readonly string[]).includes(input.health) ? input.health : "healthy";
  const interval = (CHECKIN_INTERVALS as readonly number[]).includes(Number(input.next_interval_days))
    ? Number(input.next_interval_days) : 7;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error: insErr } = await supabase.from("check_ins").insert({
    subscription_id: input.subscription_id,
    date:            input.date,
    channel,
    health,
    feedback:        input.feedback?.trim() || null,
    created_by:      user?.email || null,
  });
  if (insErr) throw new Error(insErr.message);

  const next_checkin_date = addDays(input.date, interval);
  const { error: upErr } = await supabase.from("subscriptions").update({
    next_checkin_date,
    checkin_interval_days: interval,
    health,
  }).eq("id", input.subscription_id);
  if (upErr) throw new Error(`Logged, but failed to schedule next: ${upErr.message}`);

  revalidatePath("/care");
  revalidatePath("/dashboard");
  return { ok: true, next_checkin_date, health };
}
