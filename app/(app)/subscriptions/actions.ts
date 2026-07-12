"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { advanceDate, addDays, FREQUENCIES, type Frequency } from "@/lib/recurring-utils";
import { todayIso } from "@/lib/format";
import { createReceipt } from "../receipts/actions";
import { createCycleInvoice } from "@/lib/subscription-invoice";
import type { SubscriptionRow } from "@/lib/types";

export type SubscriptionInput = {
  id?: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  service_desc: string;
  amount: number;                 // headline price BEFORE discount
  discount_percent?: number;      // 0–100; auto-applied each billing cycle
  frequency: Frequency;
  next_charge_date: string;       // YYYY-MM-DD
  remind_days_before?: number;
  status?: "active" | "paused";
  auto_invoice?: boolean;         // auto-generate a draft invoice each cycle
};

function validate(input: SubscriptionInput): Required<Omit<SubscriptionInput, "id" | "customer_email" | "customer_phone">> & Pick<SubscriptionInput, "id" | "customer_email" | "customer_phone"> {
  if (!input.customer_name?.trim())                                              throw new Error("Customer name is required.");
  if (!input.service_desc?.trim())                                               throw new Error("Service description is required.");
  if (!input.next_charge_date || !/^\d{4}-\d{2}-\d{2}$/.test(input.next_charge_date)) throw new Error("Valid next-charge date required.");
  if (!FREQUENCIES.includes(input.frequency))                                    throw new Error("Invalid frequency.");
  const amt = Number(input.amount);
  if (!isFinite(amt) || amt <= 0)                                                throw new Error("Amount must be > 0.");
  const disc = Number(input.discount_percent);
  if (input.discount_percent != null && (!isFinite(disc) || disc < 0 || disc > 100)) throw new Error("Discount must be between 0 and 100%.");
  const remind = Number(input.remind_days_before);
  return {
    id:                 input.id,
    customer_name:      input.customer_name.trim(),
    customer_email:     input.customer_email?.trim() || undefined,
    customer_phone:     input.customer_phone?.trim() || undefined,
    service_desc:       input.service_desc.trim(),
    amount:             +amt.toFixed(2),
    discount_percent:   isFinite(disc) && disc >= 0 ? +disc.toFixed(2) : 0,
    frequency:          input.frequency,
    next_charge_date:   input.next_charge_date,
    remind_days_before: isFinite(remind) && remind >= 0 ? remind : 7,
    status:             input.status === "paused" ? "paused" : "active",
    auto_invoice:       !!input.auto_invoice,
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
    discount_percent: c.discount_percent,
    frequency: c.frequency,
    next_charge_date: c.next_charge_date,
    remind_days_before: c.remind_days_before,
    status: c.status,
    auto_invoice: c.auto_invoice,
    // first after-sales check-in falls due a week after signup
    next_checkin_date: addDays(todayIso(), 7),
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
    discount_percent: c.discount_percent,
    frequency: c.frequency,
    next_charge_date: c.next_charge_date,
    remind_days_before: c.remind_days_before,
    status: c.status,
    auto_invoice: c.auto_invoice,
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
 * markSubscriptionPaid — customer paid us for this billing cycle.
 *
 * As of the discount-% upgrade this goes THROUGH the Receipt cascade
 * (was: direct transaction insert). That means every cycle now produces
 * a proper RCP-xxxx receipt + PDF the customer can be emailed, and the
 * subscription's discount_percent is applied to the headline amount so
 * the receipt shows "原价 → 折扣 X% → 实付". createReceipt() itself
 * cascades the income Transaction, so there's still a single source of
 * truth for cash-in.
 *
 * Then advance next_charge_date by the frequency and stamp last_charged.
 */
export async function markSubscriptionPaid(id: string) {
  const supabase = await createClient();

  const { data: subData, error: e1 } = await supabase
    .from("subscriptions").select("*").eq("id", id).single();
  if (e1 || !subData) throw new Error("Subscription not found.");
  const sub = subData as SubscriptionRow;

  const today = todayIso();

  // Cascade through receipt creation. One line item = the headline price;
  // the subscription's discount_percent knocks it down to the actual charge.
  await createReceipt({
    date:             today,
    customer_name:    sub.customer_name,
    customer_email:   sub.customer_email   || undefined,
    customer_address: undefined,
    items: [{
      desc:       sub.service_desc,
      qty:        1,
      unit_price: sub.amount,
      amount:     sub.amount,
    }],
    discount_percent: sub.discount_percent ?? 0,
    tax:              0,
    payment_method:   "Bank Transfer",
    category_for_income: "Service Income",
  });

  const next = advanceDate(sub.next_charge_date, sub.frequency as Frequency);

  const { error: e3 } = await supabase.from("subscriptions").update({
    last_charged_date: today,
    next_charge_date:  next,
  }).eq("id", id);
  if (e3) throw new Error("Recorded but failed to advance: " + e3.message);

  revalidatePath("/subscriptions");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/receipts");
  return { ok: true, next_charge_date: next };
}

/**
 * Manually generate the current-cycle draft invoice for a subscription
 * (same thing the daily cron does for auto_invoice subs, on demand).
 * Returns { already: true } if this cycle was already invoiced.
 */
export async function generateInvoiceForSubscription(id: string): Promise<{ ok: boolean; already?: boolean; invoice_number?: string }> {
  const supabase = await createClient();
  const { data: sub, error } = await supabase.from("subscriptions").select("*").eq("id", id).single();
  if (error || !sub) throw new Error("Subscription not found.");

  const inv = await createCycleInvoice(supabase, sub as SubscriptionRow, todayIso());
  revalidatePath("/invoices");
  revalidatePath("/subscriptions");
  if (!inv) return { ok: false, already: true };
  return { ok: true, invoice_number: inv.invoice_number };
}
