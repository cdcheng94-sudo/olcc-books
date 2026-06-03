"use server";

import { revalidatePath } from "next/cache";
import React from "react";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/queries/settings";
import { nextDocumentNumber } from "@/lib/numbering";
import { renderAndUploadPDF, refreshSignedUrl } from "@/lib/pdf/render";
import { ReceiptPDF } from "@/lib/pdf/ReceiptPDF";
import { sendReceiptEmail } from "@/lib/email";
import { fmtMoney } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/categories";
import type { LineItem, ReceiptRow } from "@/lib/types";

/**
 * Receipt server actions. The critical bit (per the schema's cascade
 * design note in 0001_init.sql) is that `createReceipt` also inserts
 * an income Transaction — receipts are the SOLE path that records cash-in.
 * Invoices never touch transactions directly.
 */

export type ReceiptInput = {
  date:                string;
  customer_name:       string;
  customer_email?:     string;
  customer_address?:   string;
  items:               LineItem[];
  discount_percent?:   number;          // 0–100, applied to subtotal before tax
  tax:                 number;          // absolute amount, not %
  payment_method:      string;
  linked_invoice_id?:  string;
  category_for_income?:string;          // default "Service Income"
};

/** total = subtotal − (subtotal × discount% / 100) + tax */
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

function validate(input: ReceiptInput) {
  if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("Valid date required.");
  if (!input.customer_name?.trim())                            throw new Error("Customer name required.");
  if (!input.items?.length)                                    throw new Error("At least one line item required.");
  for (const [i, it] of input.items.entries()) {
    if (!it.desc?.trim())                throw new Error(`Item ${i + 1}: description required.`);
    if (!isFinite(it.qty) || it.qty <= 0) throw new Error(`Item ${i + 1}: qty must be > 0.`);
    if (!isFinite(it.unit_price) || it.unit_price < 0) throw new Error(`Item ${i + 1}: unit price must be ≥ 0.`);
  }
  if (input.discount_percent != null && (!isFinite(input.discount_percent) || input.discount_percent < 0 || input.discount_percent > 100)) {
    throw new Error("Discount must be between 0 and 100%.");
  }
  if (!PAYMENT_METHODS.includes(input.payment_method as never)) {
    throw new Error(`Unknown payment method: ${input.payment_method}`);
  }
}

export async function createReceipt(input: ReceiptInput): Promise<ReceiptRow> {
  validate(input);
  const supabase = await createClient();
  const number = await nextDocumentNumber(supabase, "receipt");
  const totals = computeTotals(input.items, input.discount_percent ?? 0, input.tax);

  const { data, error } = await supabase
    .from("receipts")
    .insert({
      receipt_number:    number,
      date:              input.date,
      customer_name:     input.customer_name.trim(),
      customer_email:    input.customer_email?.trim() || null,
      customer_address:  input.customer_address?.trim() || null,
      items:             input.items,
      ...totals,
      payment_method:    input.payment_method,
      linked_invoice_id: input.linked_invoice_id || null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  const receipt = data as ReceiptRow;

  // CASCADE: record income transaction (single source of truth for cash-in)
  const { error: txError } = await supabase.from("transactions").insert({
    date:          receipt.date,
    type:          "income",
    category:      input.category_for_income || "Service Income",
    amount:        receipt.total,
    party:         receipt.customer_name,
    note:          `Receipt: ${receipt.receipt_number}`,
    linked_doc_id: receipt.id,
  });
  if (txError) {
    // Best-effort rollback so the books don't show a receipt with no transaction
    await supabase.from("receipts").delete().eq("id", receipt.id);
    throw new Error(`Receipt rolled back — transaction insert failed: ${txError.message}`);
  }

  revalidatePath("/receipts");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return receipt;
}

export async function deleteReceipt(id: string) {
  const supabase = await createClient();
  // Also clean up the cascaded transaction (matched by linked_doc_id)
  await supabase.from("transactions").delete().eq("linked_doc_id", id);
  const { error } = await supabase.from("receipts").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/receipts");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function generateReceiptPdf(id: string): Promise<string> {
  const supabase = await createClient();
  const { data: receipt, error } = await supabase.from("receipts").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  const settings = await getSettings(supabase);

  const doc = React.createElement(ReceiptPDF, { receipt: receipt as ReceiptRow, settings });
  const path = `receipts/${(receipt as ReceiptRow).receipt_number}.pdf`;
  const { url } = await renderAndUploadPDF(supabase, doc, path);

  await supabase.from("receipts").update({ pdf_url: path }).eq("id", id);

  revalidatePath("/receipts");
  return url;
}

export async function getReceiptDownloadUrl(id: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("receipts").select("pdf_url, receipt_number").eq("id", id).single();
  if (error) throw new Error(error.message);
  if (data?.pdf_url) {
    try { return await refreshSignedUrl(supabase, data.pdf_url); }
    catch { /* fall through and regenerate */ }
  }
  return await generateReceiptPdf(id);
}

export async function emailReceipt(id: string): Promise<{ ok: true }> {
  const supabase = await createClient();
  const { data: receipt, error } = await supabase.from("receipts").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  const r = receipt as ReceiptRow;

  if (!r.customer_email) throw new Error("Customer has no email — add one before sending.");

  const pdfUrl = await getReceiptDownloadUrl(id);
  const settings = await getSettings(supabase);

  await sendReceiptEmail({
    to:            r.customer_email,
    customer:      r.customer_name,
    receiptNumber: r.receipt_number,
    amount:        fmtMoney(r.total, settings.currency),
    pdfUrl,
  });
  return { ok: true };
}
