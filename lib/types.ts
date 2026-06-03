/**
 * TypeScript types mirroring the Postgres schema (see supabase/migrations/0001_init.sql).
 * Use these for query result typing throughout the app.
 *
 * Convention: column names match the database exactly (snake_case),
 * dates surface as ISO strings from Supabase JS, jsonb columns are
 * typed as concrete shapes where they have one.
 */

export type ISODate = string;       // e.g. "2026-05-28"
export type ISODateTime = string;   // e.g. "2026-05-28T10:30:00.000Z"
export type UUID = string;

// ---------- shareholders (Capital / Operating dual-pool) ----------
export type ShareholderRow = {
  id: UUID;
  name: string;
  created_at: ISODateTime;
};

// ---------- transactions ----------
export type TransactionType =
  | "income"
  | "expense"
  | "capital_injection"
  | "capital_expense"
  | "loan_repayment"
  | "interest_paid";

export type LoanType = "director_loan" | "paid_up_capital" | "other";

export type TransactionRow = {
  id: UUID;
  date: ISODate;
  type: TransactionType;
  category: string | null;        // nullable: capital/loan/interest types have none
  amount: number;
  party: string | null;
  note: string | null;
  receipt_url: string | null;
  linked_doc_id: UUID | null;
  shareholder_id: UUID | null;    // set for capital_injection / loan_repayment / interest_paid
  loan_type: LoanType | null;     // set for capital_injection
  interest_rate: number;          // reserved, default 0
  created_at: ISODateTime;
};

// ---------- invoices ----------
export type InvoiceStatus = "draft" | "sent" | "paid";

export type LineItem = {
  desc: string;
  qty: number;
  unit_price: number;
  amount: number;
};

export type InvoiceRow = {
  id: UUID;
  invoice_number: string;
  date: ISODate;
  due_date: ISODate;
  customer_name: string;
  customer_email: string | null;
  customer_address: string | null;
  site_address: string | null;
  items: LineItem[];
  subtotal: number;
  discount_percent: number;   // 0–100; applied to subtotal before tax
  tax: number;
  total: number;
  status: InvoiceStatus;
  note: string | null;
  pdf_url: string | null;
  created_at: ISODateTime;
};

// ---------- receipts ----------
export type ReceiptRow = {
  id: UUID;
  receipt_number: string;
  date: ISODate;
  customer_name: string;
  customer_email: string | null;
  customer_address: string | null;
  items: LineItem[];
  subtotal: number;
  discount_percent: number;   // 0–100; applied to subtotal before tax
  tax: number;
  total: number;
  payment_method: string;
  linked_invoice_id: UUID | null;
  pdf_url: string | null;
  created_at: ISODateTime;
};

// ---------- claims ----------
export type ClaimStatus = "pending" | "approved" | "paid";

export type ClaimRow = {
  id: UUID;
  date: ISODate;
  claimant: string;
  item_desc: string;
  amount: number;
  category: string;
  receipt_url: string | null;
  status: ClaimStatus;
  paid_date: ISODate | null;
  note: string | null;
  created_at: ISODateTime;
};

// ---------- recurring (we pay outwards) ----------
export type RecurringStatus = "active" | "paused";

export type RecurringRow = {
  id: UUID;
  name: string;
  payee: string | null;
  amount: number;
  category: string;
  frequency: "monthly" | "quarterly" | "yearly";
  next_due_date: ISODate;
  remind_days_before: number;
  status: RecurringStatus;
  last_paid_date: ISODate | null;
  created_at: ISODateTime;
};

// ---------- subscriptions (customers pay us — new in v2) ----------
export type SubscriptionStatus = "active" | "paused";

export type SubscriptionRow = {
  id: UUID;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;     // intl format like "60123456789"
  service_desc: string;
  amount: number;                    // headline price BEFORE discount
  discount_percent: number;          // 0–100; auto-applied every billing cycle
  frequency: "monthly" | "quarterly" | "yearly";
  next_charge_date: ISODate;
  remind_days_before: number;
  status: SubscriptionStatus;
  last_charged_date: ISODate | null;
  created_at: ISODateTime;
};

// ---------- settings (key/value) ----------
export type SettingRow = { key: string; value: string };

// ---------- allowed_emails (whitelist) ----------
export type AllowedEmailRow = {
  email: string;
  name: string | null;
  added_at: ISODateTime;
};
