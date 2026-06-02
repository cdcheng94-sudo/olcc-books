-- OLCC Books v2 — add discount column to invoices + receipts
-- Run via Supabase SQL Editor. Idempotent (IF NOT EXISTS guard).
--
-- After this:
--   total = subtotal - discount + tax
-- The PDF totals block surfaces all three lines so customers see the
-- "original" price they would have paid + the discount you gave them.

alter table public.invoices  add column if not exists discount numeric(14, 2) not null default 0;
alter table public.receipts  add column if not exists discount numeric(14, 2) not null default 0;

-- Drop + re-add the non-negative check (no IF NOT EXISTS for constraints).
do $$
begin
  if exists (select 1 from information_schema.table_constraints where constraint_name = 'invoices_discount_nonneg') then
    alter table public.invoices  drop constraint invoices_discount_nonneg;
  end if;
  if exists (select 1 from information_schema.table_constraints where constraint_name = 'receipts_discount_nonneg') then
    alter table public.receipts  drop constraint receipts_discount_nonneg;
  end if;
end $$;
alter table public.invoices add constraint invoices_discount_nonneg check (discount >= 0);
alter table public.receipts add constraint receipts_discount_nonneg check (discount >= 0);
