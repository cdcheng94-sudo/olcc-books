import type { SupabaseClient } from "@supabase/supabase-js";
import type { SubscriptionRow, InvoiceRow, LineItem } from "@/lib/types";
import { nextDocumentNumber } from "@/lib/numbering";

/**
 * Create a draft invoice for a subscription's current billing cycle.
 *
 * Plain server-side module (NOT "use server") so both the daily cron
 * (service-role client) and the manual "Generate invoice" action
 * (user client) can call it with their own supabase client.
 *
 * Dedup: if we already invoiced this cycle (last_invoiced_date ===
 * next_charge_date) it returns null, so the daily cron won't create a
 * duplicate every day. Stamps last_invoiced_date after creating.
 *
 * The invoice carries subscription_id → paying it rolls the subscription
 * forward (see invoices/actions markInvoicePaid).
 */
export async function createCycleInvoice(
  supabase: SupabaseClient,
  sub: SubscriptionRow,
  today: string,
): Promise<InvoiceRow | null> {
  // already invoiced for this exact cycle → skip (no duplicate)
  if (sub.last_invoiced_date && sub.last_invoiced_date === sub.next_charge_date) return null;

  const unit = Number(sub.amount) || 0;
  const subtotal = +unit.toFixed(2);
  const discountPct = +(sub.discount_percent || 0).toFixed(2);
  const total = +(subtotal - subtotal * discountPct / 100).toFixed(2);
  const items: LineItem[] = [{ desc: sub.service_desc, qty: 1, unit_price: unit, amount: subtotal }];

  const number = await nextDocumentNumber(supabase, "invoice");

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      invoice_number:   number,
      date:             today,
      due_date:         sub.next_charge_date,
      customer_name:    sub.customer_name,
      customer_email:   sub.customer_email ?? null,
      customer_address: null,
      site_address:     null,
      items,
      subtotal,
      discount_percent: discountPct,
      tax:              0,
      total,
      status:           "draft",
      note:             null,
      subscription_id:  sub.id,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  await supabase.from("subscriptions")
    .update({ last_invoiced_date: sub.next_charge_date })
    .eq("id", sub.id);

  return data as InvoiceRow;
}
