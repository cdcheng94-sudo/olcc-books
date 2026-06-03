"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createInvoice } from "../invoices/actions";
import { createSubscription } from "../subscriptions/actions";
import { EDUFLOW_PLANS, type EduFlowPlanKey } from "@/lib/eduflow-plans";
import type { LineItem } from "@/lib/types";

/**
 * EduFlow "New Customer" orchestration. One form click does both:
 *
 *   1. Open an Invoice (Setup fee + first month if not the free-month plan)
 *   2. Create a Subscription that tracks monthly billing from there on
 *
 * Net effect: a new EduFlow customer is fully on the books in ~5 seconds.
 *
 * Failure model — if the subscription insert fails AFTER the invoice was
 * created, we still return the invoice ID so the operator can recover
 * manually (the books aren't double-charged either way).
 */

export type EduFlowOnboardInput = {
  customer_name:        string;
  customer_email?:      string;
  customer_phone?:      string;
  customer_address?:    string;
  plan:                 EduFlowPlanKey;
  start_date:           string;      // YYYY-MM-DD
  // For Enterprise (or operator override), allow custom amounts:
  monthly_override?:    number;
  setup_override?:      number;
  first_month_free:     boolean;
  monthly_discount_percent?: number;  // 0–100; folds into the monthly subscription
                                      // (recurring) AND the first-month line
  setup_discount_percent?:   number;  // 0–100; one-time, only on the setup fee line
};

/** Add one month to an ISO date, clamping day-of-month (Jan 31 → Feb 28). */
function plusOneMonth(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const day = d.getDate();
  d.setMonth(d.getMonth() + 1);
  // setMonth may overflow — e.g. Jan 31 + 1 month = Mar 3. Clamp back.
  if (d.getDate() !== day) d.setDate(0);
  return d.toISOString().slice(0, 10);
}

export async function onboardEduFlowCustomer(input: EduFlowOnboardInput): Promise<{
  invoice_id:      string;
  subscription_id: string;
}> {
  // ---- Validate ----
  if (!input.customer_name?.trim())             throw new Error("Customer name required.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.start_date)) throw new Error("Valid start date required.");
  const plan = EDUFLOW_PLANS[input.plan];
  if (!plan) throw new Error(`Unknown plan: ${input.plan}`);

  const monthly = +(input.monthly_override ?? plan.monthly).toFixed(2);
  const setup   = +(input.setup_override   ?? plan.setup).toFixed(2);
  if (!isFinite(monthly) || monthly <= 0) throw new Error("Monthly amount must be > 0.");
  if (!isFinite(setup)   || setup   <  0) throw new Error("Setup fee must be ≥ 0.");

  const clampPct = (v: number | undefined, label: string) => {
    const d = Number(v);
    if (!isFinite(d) || d <= 0) return 0;
    if (d > 100) throw new Error(`${label} discount must be between 0 and 100%.`);
    return +d.toFixed(2);
  };
  const monthlyDiscPct = clampPct(input.monthly_discount_percent, "Monthly");
  const setupDiscPct   = clampPct(input.setup_discount_percent, "Setup");

  // ---- Build invoice line items ----
  // Discounts are baked into each line's price (kept positive so they pass
  // line validation) with the rate noted in the description, so the customer
  // sees the original + the discount on the PDF.
  const items: LineItem[] = [];
  if (setup > 0) {
    const netSetup = +(setup * (1 - setupDiscPct / 100)).toFixed(2);
    items.push({
      desc:       setupDiscPct > 0
        ? `EduFlow ${plan.label} — Setup fee (−${setupDiscPct}%, was MYR ${setup.toFixed(2)})`
        : `EduFlow ${plan.label} — Setup fee (one-time)`,
      qty:        1,
      unit_price: netSetup,
      amount:     netSetup,
    });
  }
  if (!input.first_month_free) {
    const netMonthly = +(monthly * (1 - monthlyDiscPct / 100)).toFixed(2);
    items.push({
      desc:       monthlyDiscPct > 0
        ? `EduFlow ${plan.label} — First month (−${monthlyDiscPct}%, was MYR ${monthly.toFixed(2)})`
        : `EduFlow ${plan.label} — First month subscription`,
      qty:        1,
      unit_price: netMonthly,
      amount:     netMonthly,
    });
  }
  if (items.length === 0) {
    // Should never happen unless setup = 0 AND first month is free; guard anyway.
    items.push({ desc: `EduFlow ${plan.label} — Onboarding`, qty: 1, unit_price: 0, amount: 0 });
  }

  // ---- 1. Create Invoice (draft) ----
  // Due date = start date + 7 days (standard payment window for setup invoices)
  const dueDate = (() => {
    const d = new Date(input.start_date + "T00:00:00");
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  })();

  const invoice = await createInvoice({
    date:             input.start_date,
    due_date:         dueDate,
    customer_name:    input.customer_name.trim(),
    customer_email:   input.customer_email,
    customer_address: input.customer_address,
    items,
    discount_percent: 0,   // discounts are baked into the line items above
    tax:              0,
    note:             `EduFlow ${plan.label} plan — recurring subscription tracked separately.${input.first_month_free ? " First month is complimentary." : ""}${monthlyDiscPct > 0 ? ` ${monthlyDiscPct}% discount applies to every monthly bill.` : ""}`,
  });

  // ---- 2. Create Subscription (next charge = start + 1 month) ----
  const nextCharge = plusOneMonth(input.start_date);
  let subscriptionId: string;
  try {
    const sub = await createSubscription({
      customer_name:       input.customer_name.trim(),
      customer_email:      input.customer_email,
      customer_phone:      input.customer_phone,
      service_desc:        `EduFlow ${plan.label} — monthly subscription`,
      amount:              monthly,
      discount_percent:    monthlyDiscPct,
      frequency:           "monthly",
      next_charge_date:    nextCharge,
      remind_days_before:  7,
      status:              "active",
    });
    subscriptionId = sub.id;
  } catch (e) {
    // Invoice already exists — propagate a partial-success error so the
    // operator can recover (subscription can be created manually with the
    // info already in front of them).
    throw new Error(
      `Invoice ${invoice.invoice_number} created OK, but subscription insert failed: ${(e as Error).message}. ` +
      `Open /subscriptions and add it manually.`,
    );
  }

  revalidatePath("/invoices");
  revalidatePath("/subscriptions");
  revalidatePath("/dashboard");
  return { invoice_id: invoice.id, subscription_id: subscriptionId };
}
