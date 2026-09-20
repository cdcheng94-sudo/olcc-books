-- 0012_invoice_cancel.sql
-- Void an issued invoice instead of deleting it.
--
-- Why: deleting an invoice that was already sent breaks the audit trail (the
-- customer still holds that PDF) and leaves an unexplained hole in the
-- INV-xxxx sequence, which an accountant will ask about. A cancelled invoice
-- keeps its number and records WHY it was voided.
--
-- Paid invoices can never be cancelled — they own a receipt and an income
-- transaction; voiding one would orphan real money. Enforced in the app layer
-- (cancelInvoice) since the rule needs a readable error message.

alter table public.invoices drop constraint if exists invoices_status_check;

alter table public.invoices
  add constraint invoices_status_check
  check (status in ('draft', 'sent', 'paid', 'cancelled'));

alter table public.invoices
  add column if not exists cancelled_at  timestamptz,
  add column if not exists cancel_reason text;
