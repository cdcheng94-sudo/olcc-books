-- OLCC Books v2 — initial schema
-- Run via Supabase SQL Editor (Project → SQL Editor → new query → paste → Run).
-- Idempotent for the most part: tables guard with IF NOT EXISTS, but RLS
-- policies will error if re-run. Drop them first if iterating.

-- =====================================================================
-- 1. SETTINGS — single-row-per-key, holds company info and counters
-- =====================================================================
create table if not exists public.settings (
  key   text primary key,
  value text not null default ''
);

-- =====================================================================
-- 2. ALLOWED_EMAILS — gatekeeper for who can use the app
-- =====================================================================
create table if not exists public.allowed_emails (
  email     text primary key,
  name      text,
  added_at  timestamptz not null default now()
);

-- =====================================================================
-- 3. TRANSACTIONS — the ledger; everything cash-affecting ends here
-- =====================================================================
create table if not exists public.transactions (
  id              uuid primary key default gen_random_uuid(),
  date            date not null,
  type            text not null check (type in ('income', 'expense')),
  category        text not null,
  amount          numeric(14, 2) not null check (amount >= 0),
  party           text,
  note            text,
  receipt_url     text,
  linked_doc_id   uuid,                 -- back-reference to invoice/receipt/claim/recurring
  created_at      timestamptz not null default now()
);
create index if not exists transactions_date_idx     on public.transactions (date desc);
create index if not exists transactions_type_idx     on public.transactions (type);
create index if not exists transactions_category_idx on public.transactions (category);
create index if not exists transactions_linked_idx   on public.transactions (linked_doc_id);

-- =====================================================================
-- 4. INVOICES — outgoing bills (we ask customer to pay)
-- =====================================================================
create table if not exists public.invoices (
  id                uuid primary key default gen_random_uuid(),
  invoice_number    text not null unique,
  date              date not null,
  due_date          date not null,
  customer_name     text not null,
  customer_email    text,
  customer_address  text,
  site_address      text,
  items             jsonb not null default '[]'::jsonb,
  subtotal          numeric(14, 2) not null default 0,
  tax               numeric(14, 2) not null default 0,
  total             numeric(14, 2) not null default 0,
  status            text not null default 'draft' check (status in ('draft', 'sent', 'paid')),
  note              text,
  pdf_url           text,
  created_at        timestamptz not null default now()
);
create index if not exists invoices_status_idx on public.invoices (status);
create index if not exists invoices_date_idx   on public.invoices (date desc);

-- =====================================================================
-- 5. RECEIPTS — confirmation that we received money (cash-in)
--    CRITICAL DESIGN: only the Receipt → Transaction cascade is the
--    path that records income. Invoices never create transactions
--    directly. Mark-paid on an invoice creates a Receipt, which then
--    creates the Transaction. This prevents double-counting.
-- =====================================================================
create table if not exists public.receipts (
  id                  uuid primary key default gen_random_uuid(),
  receipt_number      text not null unique,
  date                date not null,
  customer_name       text not null,
  customer_email      text,
  customer_address    text,
  items               jsonb not null default '[]'::jsonb,
  subtotal            numeric(14, 2) not null default 0,
  tax                 numeric(14, 2) not null default 0,
  total               numeric(14, 2) not null default 0,
  payment_method      text not null default 'Bank Transfer',
  linked_invoice_id   uuid references public.invoices(id) on delete set null,
  pdf_url             text,
  created_at          timestamptz not null default now()
);
create index if not exists receipts_date_idx           on public.receipts (date desc);
create index if not exists receipts_linked_invoice_idx on public.receipts (linked_invoice_id);

-- =====================================================================
-- 6. CLAIMS — employee reimbursement flow (pending → approved → paid)
-- =====================================================================
create table if not exists public.claims (
  id            uuid primary key default gen_random_uuid(),
  date          date not null,
  claimant      text not null,
  item_desc     text not null,
  amount        numeric(14, 2) not null check (amount > 0),
  category      text not null,            -- Supplies / Transport / Meals / Other
  receipt_url   text,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'paid')),
  paid_date     date,
  note          text,
  created_at    timestamptz not null default now()
);
create index if not exists claims_status_idx on public.claims (status);
create index if not exists claims_date_idx   on public.claims (date desc);

-- =====================================================================
-- 7. RECURRING — money WE pay regularly (e.g. accountant, rent)
-- =====================================================================
create table if not exists public.recurring (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  payee                text,
  amount               numeric(14, 2) not null check (amount > 0),
  category             text not null default 'Other Expense',
  frequency            text not null check (frequency in ('monthly', 'quarterly', 'yearly')),
  next_due_date        date not null,
  remind_days_before   int  not null default 7 check (remind_days_before >= 0),
  status               text not null default 'active' check (status in ('active', 'paused')),
  last_paid_date       date,
  created_at           timestamptz not null default now()
);
create index if not exists recurring_status_idx on public.recurring (status);
create index if not exists recurring_due_idx    on public.recurring (next_due_date);

-- =====================================================================
-- 8. SUBSCRIPTIONS — customers paying US regularly (NEW in v2)
--    Opposite direction of `recurring`: we chase customers to pay.
-- =====================================================================
create table if not exists public.subscriptions (
  id                   uuid primary key default gen_random_uuid(),
  customer_name        text not null,
  customer_email       text,
  customer_phone       text,                  -- intl format e.g. "60123456789"
  service_desc         text not null,
  amount               numeric(14, 2) not null check (amount > 0),
  frequency            text not null check (frequency in ('monthly', 'quarterly', 'yearly')),
  next_charge_date     date not null,
  remind_days_before   int  not null default 7 check (remind_days_before >= 0),
  status               text not null default 'active' check (status in ('active', 'paused')),
  last_charged_date    date,
  created_at           timestamptz not null default now()
);
create index if not exists subscriptions_status_idx on public.subscriptions (status);
create index if not exists subscriptions_due_idx    on public.subscriptions (next_charge_date);

-- =====================================================================
-- ROW LEVEL SECURITY — flat permission model
-- Per spec §1: "公司内部不超过 10 人,所有人权限相同". We enforce only
-- that the caller is authenticated; whitelisting against allowed_emails
-- happens in the app layer for nicer UX.
-- =====================================================================
alter table public.settings        enable row level security;
alter table public.allowed_emails  enable row level security;
alter table public.transactions    enable row level security;
alter table public.invoices        enable row level security;
alter table public.receipts        enable row level security;
alter table public.claims          enable row level security;
alter table public.recurring       enable row level security;
alter table public.subscriptions   enable row level security;

-- Helper: one policy per table that allows everything for authenticated users.
do $$
declare t text;
begin
  for t in select unnest(array[
    'settings','allowed_emails','transactions','invoices',
    'receipts','claims','recurring','subscriptions'
  ]) loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      t || '_authed_all', t
    );
  end loop;
end $$;
