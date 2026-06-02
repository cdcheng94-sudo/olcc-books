"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { advanceDate, FREQUENCIES, type Frequency } from "@/lib/recurring-utils";
import { todayIso } from "@/lib/format";

export type SubscriptionInput = {
  id?: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  service_desc: string;
  amount: number;
  frequency: Frequency;
  next_charge_date: string;     // YYYY-MM-DD
  remind_days_before?: number;
  status?: "active" | "paused";
};

function validate(input: SubscriptionInput): SubscriptionInput {
  if (!input.customer_name?.trim())                                              throw new Error("Customer name is required.");
  if (!input.service_desc?.trim())                                               throw new Error("Service description is required.");
  if (!input.next_charge_date || !/^\d{4}-\d{2}-\d{2}$/.test(input.next_charge_date)) throw new Error("Valid next-charge date required.");
  if (!FREQUENCIES.includes(input.frequency))                                    throw new Error("Invalid frequency.");
  const amt = Number(input.amount);
  if (!isFinite(amt) || amt <= 0)                                                throw new Error("Amount must be > 0.");
  const remind = Number(input.remind_days_before);
  return {
    id:                 input.id,
    customer_name:      input.customer_name.trim(),
    customer_email:     input.customer_email?.trim() || undefined,
    customer_phone:     input.customer_phone?.trim() || undefined,
    service_desc:       input.service_desc.trim(),
    amount:             +amt.toFixed(2),
    frequency:          input.frequency,
    next_charge_date:   input.next_charge_date,
    remind_days_before: isFinite(remind) && remind >= 0 ? remind : 7,
    status:             input.status === "paused" ? "paused" : "active",
  };
}

export async function createSubscription(input: SubscriptionInput) {
  const c = validate(input);
  const supabase = await createClient();
  const { data, error } = await supabase.from("subscriptions").insert({
    customer_name: c.customer_name,
    customer_email: c.customer_email ?? null,
    customer_phone: c.customer_phone ?? null,
    service_desc: c.service_desc,
    amount: c.amount,
    frequency: c.frequency,
    next_charge_date: c.next_charge_date,
    remind_days_before: c.remind_days_before,
    status: c.status,
  }).select().single();
  if (error) throw new Error(error.message);
  revalidatePath("/subscriptions");
  revalidatePath("/dashboard");
  return data;
}

export async function updateSubscription(id: string, input: SubscriptionInput) {
  const c = validate({ ...input, id });
  const supabase = await createClient();
  const { data, error } = await supabase.from("subscriptions").update({
    customer_name: c.customer_name,
    customer_email: c.customer_email ?? null,
    customer_phone: c.customer_phone ?? null,
    service_desc: c.service_desc,
    amount: c.amount,
    frequency: c.frequency,
    next_charge_date: c.next_charge_date,
    remind_days_before: c.remind_days_before,
    status: c.status,
  }).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  revalidatePath("/subscriptions");
  revalidatePath("/dashboard");
  return data;
}

export async function deleteSubscription(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("subscriptions").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/subscriptions");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * markSubscriptionPaid — customer paid us. Insert an INCOME Transaction
 * (category Service Income — owner can recategorize on the Transactions
 * page if needed), advance next_charge_date by frequency. Future phase
 * will also auto-generate a Receipt PDF and email it to the customer.
 */
export async function markSubscriptionPaid(id: string) {
  const supabase = await createClient();

  const { data: sub, error: e1 } = await supabase
    .from("subscriptions").select("*").eq("id", id).single();
  if (e1 || !sub) throw new Error("Subscription not found.");

  const today = todayIso();

  const { error: e2 } = await supabase.from("transactions").insert({
    date:          today,
    type:          "income",
    category:      "Service Income",
    amount:        sub.amount,
    party:         sub.customer_name,
    note:          `Subscription: ${sub.service_desc}`,
    linked_doc_id: sub.id,
  });
  if (e2) throw new Error("Failed to record income: " + e2.message);

  const next = advanceDate(sub.next_charge_date, sub.frequency as Frequency);

  const { error: e3 } = await supabase.from("subscriptions").update({
    last_charged_date: today,
    next_charge_date:  next,
  }).eq("id", id);
  if (e3) throw new Error("Recorded but failed to advance: " + e3.message);

  revalidatePath("/subscriptions");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  return { ok: true, next_charge_date: next };
}
