"use server";

import { revalidatePath } from "next/cache";
import React from "react";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/queries/settings";
import { nextDocumentNumber } from "@/lib/numbering";
import { renderAndUploadPDF, refreshSignedUrl } from "@/lib/pdf/render";
import { InvoicePDF } from "@/lib/pdf/InvoicePDF";
import { sendInvoiceEmail } from "@/lib/email";
import { fmtMoney } from "@/lib/format";
import { advanceDate, type Frequency } from "@/lib/recurring-utils";
import { createReceipt } from "../receipts/actions";
import type { InvoiceRow, InvoiceStatus, LineItem } from "@/lib/types";

/**
 * Invoice server actions. Two flows worth calling out:
 *
 *   - sendInvoiceByEmail(): renders the PDF (if not already), uploads to
 *     Storage, attaches to a Resend email, and flips status draft → sent.
 *
 *   - markInvoicePaid(): does NOT touch the Transactions table directly.
 *     Instead it creates a Receipt via createReceipt() — which cascades
 *     the income Transaction itself. This keeps "money came in" as a
 *     single observable event, matching the cascade design in 0001_init.sql.
 */

export type InvoiceInput = {
  date:              string;
  due_date:          string;
  customer_name:     string;
  customer_email?:   string;
  customer_address?: string;
  site_address?:     string;
  items:             LineItem[];
  discount_percent?: number;          // 0–100, applied to subtotal before tax
  tax:               number;          // absolute amount added after discount
  note?:             string;
};

/**
 * total = subtotal − (subtotal × discount% / 100) + tax
 * We store only the percent; the resolved discount amount is recomputed
 * at PDF-render time from subtotal so there's a single source of truth.
 */
function computeTotals(items: LineItem[], discountPercent: number, tax: number) {
  const subtotal       = items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
  const discountAmount = subtotal * (discountPercent / 100);
  return {
    subtotal:         +subtotal.toFixed(2),
    discount_percent: +discountPercent.toFixed(2),
    tax:              +tax.toFixed(2),
    total:            +(subtotal - discountAmount + tax).toFixed(2),
  };
}

function validate(input: InvoiceInput) {
  if (!input.date     || !/^\d{4}-\d{2}-\d{2}$/.test(input.date))     throw new Error("Valid date required.");
  if (!input.due_date || !/^\d{4}-\d{2}-\d{2}$/.test(input.due_date)) throw new Error("Valid due date required.");
  if (!input.customer_name?.trim())                                   throw new Error("Customer name required.");
  if (!input.items?.length)                                           throw new Error("At least one line item required.");
  for (const [i, it] of input.items.entries()) {
    if (!it.desc?.trim())                              throw new Error(`Item ${i + 1}: description required.`);
    if (!isFinite(it.qty) || it.qty <= 0)              throw new Error(`Item ${i + 1}: qty must be > 0.`);
    if (!isFinite(it.unit_price) || it.unit_price < 0) throw new Error(`Item ${i + 1}: unit price must be ≥ 0.`);
  }
  if (input.discount_percent != null && (!isFinite(input.discount_percent) || input.discount_percent < 0 || input.discount_percent > 100)) {
    throw new Error("Discount must be between 0 and 100%.");
  }
}

export async function createInvoice(input: InvoiceInput): Promise<InvoiceRow> {
  validate(input);
  const supabase = await createClient();
  const number = await nextDocumentNumber(supabase, "invoice");
  const totals = computeTotals(input.items, input.discount_percent ?? 0, input.tax);

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      invoice_number:   number,
      date:             input.date,
      due_date:         input.due_date,
      customer_name:    input.customer_name.trim(),
      customer_email:   input.customer_email?.trim()   || null,
      customer_address: input.customer_address?.trim() || null,
      site_address:     input.site_address?.trim()     || null,
      items:            input.items,
      ...totals,
      status:           "draft",
      note:             input.note?.trim() || null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/invoices");
  return data as InvoiceRow;
}

export async function updateInvoice(id: string, input: InvoiceInput): Promise<InvoiceRow> {
  validate(input);
  const supabase = await createClient();
  const totals = computeTotals(input.items, input.discount_percent ?? 0, input.tax);

  const { data, error } = await supabase
    .from("invoices")
    .update({
      date:             input.date,
      due_date:         input.due_date,
      customer_name:    input.customer_name.trim(),
      customer_email:   input.customer_email?.trim()   || null,
      customer_address: input.customer_address?.trim() || null,
      site_address:     input.site_address?.trim()     || null,
      items:            input.items,
      ...totals,
      note:             input.note?.trim() || null,
      // Invalidate stale PDF so the next download regenerates with new content
      pdf_url:          null,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/invoices");
  return data as InvoiceRow;
}

export async function deleteInvoice(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("invoices").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/invoices");
  return { ok: true };
}

export async function setInvoiceStatus(id: string, status: InvoiceStatus): Promise<InvoiceRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .update({ status })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/invoices");
  return data as InvoiceRow;
}

async function regeneratePdfFor(supabase: Awaited<ReturnType<typeof createClient>>, id: string): Promise<string> {
  const { data: invoice, error } = await supabase.from("invoices").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  const settings = await getSettings(supabase);
  const inv = invoice as InvoiceRow;

  const doc  = React.createElement(InvoicePDF, { invoice: inv, settings });
  const path = `invoices/${inv.invoice_number}.pdf`;
  const { url } = await renderAndUploadPDF(supabase, doc, path);
  await supabase.from("invoices").update({ pdf_url: path }).eq("id", id);
  revalidatePath("/invoices");
  return url;
}

export async function generateInvoicePdf(id: string): Promise<string> {
  const supabase = await createClient();
  return await regeneratePdfFor(supabase, id);
}

export async function getInvoiceDownloadUrl(id: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("invoices").select("pdf_url").eq("id", id).single();
  if (error) throw new Error(error.message);
  if (data?.pdf_url) {
    try { return await refreshSignedUrl(supabase, data.pdf_url); }
    catch { /* fall through and regenerate */ }
  }
  return await regeneratePdfFor(supabase, id);
}

export async function sendInvoiceByEmail(id: string): Promise<{ ok: true }> {
  const supabase = await createClient();
  const { data: invoice, error } = await supabase.from("invoices").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  const inv = invoice as InvoiceRow;

  if (!inv.customer_email) throw new Error("Customer has no email — add one before sending.");

  // Always (re-)render so the PDF reflects current invoice content
  const pdfUrl   = await regeneratePdfFor(supabase, id);
  const settings = await getSettings(supabase);

  await sendInvoiceEmail({
    to:            inv.customer_email,
    customer:      inv.customer_name,
    invoiceNumber: inv.invoice_number,
    amount:        fmtMoney(inv.total, settings.currency),
    dueDate:       inv.due_date,
    pdfUrl,
  });

  // Move to "sent" if still draft
  if (inv.status === "draft") {
    await supabase.from("invoices").update({ status: "sent" }).eq("id", id);
  }
  revalidatePath("/invoices");
  return { ok: true };
}

/**
 * Mark Paid cascade: invoice → receipt → transaction.
 *   - Receipt copies the invoice's customer + items
 *   - createReceipt() inserts the income Transaction (single source of truth)
 *   - Then we flip the invoice status to 'paid'
 */
export async function markInvoicePaid(id: string, paymentMethod: string = "Bank Transfer", paidDate?: string): Promise<{ ok: true; receipt_id: string; transaction_id: string | null; customer_name: string; date: string }> {
  const supabase = await createClient();
  const { data: invoice, error } = await supabase.from("invoices").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  const inv = invoice as InvoiceRow;

  if (inv.status === "paid") throw new Error("Invoice is already paid.");

  // Payment date defaults to today, but the caller can pass the actual date
  // the customer paid (so the receipt + income transaction are dated right).
  const date = (paidDate && /^\d{4}-\d{2}-\d{2}$/.test(paidDate))
    ? paidDate
    : new Date().toISOString().slice(0, 10);

  // Cascade through receipt creation (carry over discount% + tax so the
  // receipt shows the same breakdown as the invoice the customer paid)
  const receipt = await createReceipt({
    date,
    customer_name:     inv.customer_name,
    customer_email:    inv.customer_email   || undefined,
    customer_address:  inv.customer_address || undefined,
    items:             inv.items,
    discount_percent:  inv.discount_percent,
    tax:               inv.tax,
    payment_method:    paymentMethod,
    linked_invoice_id: inv.id,
  });

  // Flip invoice status
  await supabase.from("invoices").update({ status: "paid" }).eq("id", id);

  // If this invoice was auto-generated from a subscription cycle, roll that
  // subscription forward so the next cycle can bill (single collection path:
  // pay the invoice → receipt + income + subscription advances).
  if (inv.subscription_id) {
    const { data: sub } = await supabase
      .from("subscriptions").select("frequency, next_charge_date").eq("id", inv.subscription_id).maybeSingle();
    if (sub) {
      const next = advanceDate(sub.next_charge_date, sub.frequency as Frequency);
      await supabase.from("subscriptions")
        .update({ last_charged_date: date, next_charge_date: next })
        .eq("id", inv.subscription_id);
      revalidatePath("/subscriptions");
    }
  }

  // The cascade inserts an income transaction tagged with linked_doc_id =
  // receipt.id. Return its id so the UI can attach the customer's payment
  // proof (if they sent one) to that transaction's receipt_url.
  const { data: txRow } = await supabase
    .from("transactions")
    .select("id")
    .eq("linked_doc_id", receipt.id)
    .maybeSingle();

  revalidatePath("/invoices");
  revalidatePath("/receipts");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { ok: true, receipt_id: receipt.id, transaction_id: txRow?.id ?? null, customer_name: inv.customer_name, date };
}
