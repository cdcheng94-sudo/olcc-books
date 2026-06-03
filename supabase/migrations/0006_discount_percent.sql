-- OLCC Books v2 — switch discount semantics from MYR amount to percent (%)
-- and add a persistent discount_percent to subscriptions so monthly billings
-- inherit the discount automatically.
--
-- Run AFTER 0005_add_discount.sql in Supabase SQL Editor.
-- Safe to run on the live DB IF no invoices/receipts have a non-zero
-- discount amount (which is the case immediately post-launch). If any
-- exist, run a manual fixup before applying.

-- ---- invoices ----
alter table public.invoices drop constraint if exists invoices_discount_nonneg;
alter table public.invoices drop column if exists discount;
alter table public.invoices add  column if not exists discount_percent numeric(5, 2) not null default 0;
alter table public.invoices add  constraint invoices_discount_percent_range check (discount_percent >= 0 and discount_percent <= 100);

-- ---- receipts ----
alter table public.receipts drop constraint if exists receipts_discount_nonneg;
alter table public.receipts drop column if exists discount;
alter table public.receipts add  column if not exists discount_percent numeric(5, 2) not null default 0;
alter table public.receipts add  constraint receipts_discount_percent_range check (discount_percent >= 0 and discount_percent <= 100);

-- ---- subscriptions (new) ----
alter table public.subscriptions add column if not exists discount_percent numeric(5, 2) not null default 0;
do $$
begin
  if not exists (select 1 from information_schema.table_constraints where constraint_name = 'subscriptions_discount_percent_range') then
    alter table public.subscriptions add constraint subscriptions_discount_percent_range check (discount_percent >= 0 and discount_percent <= 100);
  end if;
end $$;
