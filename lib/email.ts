/**
 * Resend wrapper. Two send functions — sendInvoiceEmail + sendReceiptEmail
 * — that fetch the PDF buffer from a Supabase signed URL, then ship it
 * as an attachment alongside a plain-text body. Failures throw, so server
 * actions can surface them in the UI rather than silently swallow.
 *
 * Env vars consumed:
 *   RESEND_API_KEY   — auth
 *   RESEND_FROM      — "Display Name <addr@domain>" or just an address
 */

import { Resend } from "resend";

const FROM = process.env.RESEND_FROM || "OLCC Books <onboarding@resend.dev>";

function client() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY missing. Email cannot be sent.");
  return new Resend(key);
}

async function fetchPdfBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch PDF (${res.status})`);
  const arr = await res.arrayBuffer();
  return Buffer.from(arr);
}

export async function sendInvoiceEmail(opts: {
  to: string;
  customer: string;
  invoiceNumber: string;
  amount: string;        // pre-formatted, e.g. "MYR 3,500.00"
  dueDate: string;       // pre-formatted, e.g. "30 Jun 2026"
  pdfUrl: string;
}) {
  const pdfBuf = await fetchPdfBuffer(opts.pdfUrl);
  const resend = client();

  const { data, error } = await resend.emails.send({
    from: FROM,
    to:   opts.to,
    subject: `Invoice ${opts.invoiceNumber} from OLCC Technology`,
    text: [
      `Dear ${opts.customer},`,
      ``,
      `Please find attached invoice ${opts.invoiceNumber} for ${opts.amount}, due on ${opts.dueDate}.`,
      ``,
      `Bank transfer details are on the invoice. Reply to this email if you have any questions.`,
      ``,
      `Thank you,`,
      `OLCC Technology Sdn Bhd`,
    ].join("\n"),
    attachments: [
      { filename: `${opts.invoiceNumber}.pdf`, content: pdfBuf },
    ],
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
  return data;
}

export async function sendReceiptEmail(opts: {
  to: string;
  customer: string;
  receiptNumber: string;
  amount: string;
  pdfUrl: string;
}) {
  const pdfBuf = await fetchPdfBuffer(opts.pdfUrl);
  const resend = client();

  const { data, error } = await resend.emails.send({
    from: FROM,
    to:   opts.to,
    subject: `Receipt ${opts.receiptNumber} — payment received`,
    text: [
      `Dear ${opts.customer},`,
      ``,
      `We've received your payment of ${opts.amount}. Your official receipt ${opts.receiptNumber} is attached.`,
      ``,
      `Thank you for your business.`,
      ``,
      `OLCC Technology Sdn Bhd`,
    ].join("\n"),
    attachments: [
      { filename: `${opts.receiptNumber}.pdf`, content: pdfBuf },
    ],
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
  return data;
}
