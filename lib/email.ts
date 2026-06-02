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

// ---- Reminder emails (called by /api/cron/daily-reminders) ----

export async function sendSubscriptionReminder(opts: {
  to:           string;
  customer:     string;
  service:      string;
  amount:       string;
  dueDate:      string;       // "12 Jun 2026"
  daysLabel:    string;       // "Due tomorrow" / "Due in 3 days" / "5 days overdue"
  bankInfo?:    { name?: string; account?: string; accountNo?: string };
}) {
  const resend = client();
  const bank = opts.bankInfo;
  const bankLines = bank?.name
    ? [
        ``,
        `Payment details:`,
        `  Bank:         ${bank.name}`,
        `  Account name: ${bank.account || ""}`,
        `  Account no.:  ${bank.accountNo || ""}`,
      ]
    : [];

  const { data, error } = await resend.emails.send({
    from: FROM,
    to:   opts.to,
    subject: `Reminder: ${opts.service} — ${opts.daysLabel}`,
    text: [
      `Dear ${opts.customer},`,
      ``,
      `This is a friendly reminder that your subscription "${opts.service}" (${opts.amount}) ${opts.daysLabel.toLowerCase()} on ${opts.dueDate}.`,
      ...bankLines,
      ``,
      `Reply to this email if you have any questions or need to update your billing.`,
      ``,
      `Thank you,`,
      `OLCC Technology Sdn Bhd`,
    ].join("\n"),
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
  return data;
}

export async function sendRecurringDigest(opts: {
  to:    string;
  items: Array<{ name: string; payee: string; amount: string; dueDate: string; daysLabel: string }>;
}) {
  if (opts.items.length === 0) return null;
  const resend = client();

  const lines = opts.items.map((it, i) =>
    `${i + 1}. ${it.name} (${it.payee})  —  ${it.amount}  —  ${it.daysLabel} (${it.dueDate})`,
  );

  const { data, error } = await resend.emails.send({
    from: FROM,
    to:   opts.to,
    subject: `OLCC Books — ${opts.items.length} payment${opts.items.length === 1 ? "" : "s"} due soon`,
    text: [
      `Heads up — the following recurring payments are due soon:`,
      ``,
      ...lines,
      ``,
      `Mark them paid in OLCC Books after settling:`,
      `https://olcc-books.vercel.app/recurring`,
      ``,
      `(Auto-sent by OLCC Books daily reminder cron.)`,
    ].join("\n"),
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
  return data;
}
