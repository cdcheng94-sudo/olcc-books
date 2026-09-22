-- 0013_receipt_emailed.sql
-- Remember when a receipt was last emailed to the customer, and how many times.
--
-- Invoices already carry a "sent" status; receipts had nothing, so after
-- clicking ✉ there was no way to tell which ones had gone out. Re-sending stays
-- allowed — the stamp is a marker, not a lock — the UI just asks before doing
-- it again and shows the last date.

alter table public.receipts
  add column if not exists emailed_at  timestamptz,
  add column if not exists email_count integer not null default 0;
