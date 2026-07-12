-- 0011_subscription_auto_invoice.sql
-- Auto-generate a draft invoice each billing cycle for subscriptions that
-- want formal invoices (not just reminder emails).
--
-- - subscriptions.auto_invoice: opt-in per subscription.
-- - subscriptions.last_invoiced_date: the next_charge_date we already
--   invoiced, so the daily cron doesn't create a duplicate every day.
-- - invoices.subscription_id: links a cycle invoice back to its
--   subscription so paying the invoice rolls the subscription forward.

alter table public.subscriptions
  add column if not exists auto_invoice        boolean not null default false,
  add column if not exists last_invoiced_date  date;

alter table public.invoices
  add column if not exists subscription_id uuid references public.subscriptions(id) on delete set null;

create index if not exists invoices_subscription_idx on public.invoices (subscription_id);
