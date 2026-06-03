-- 0008_shareholder_loan_split.sql
-- Split Shareholder Loan (借款 — repayable liability, has outstanding, earns
-- interest) from Capital Injection (股本/equity — affects ownership, not repaid).
--
-- Already run on prod. category stays nullable; loan_type column kept but
-- no longer used (the type itself now distinguishes loan vs equity).

alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions add constraint transactions_type_check
  check (type in ('income','expense','capital_injection','shareholder_loan','capital_expense','loan_repayment','interest_paid'));

alter table public.transactions drop constraint if exists transactions_shareholder_required;
alter table public.transactions add constraint transactions_shareholder_required
  check (
    (type in ('capital_injection','shareholder_loan','loan_repayment','interest_paid') and shareholder_id is not null)
    or
    (type in ('income','expense','capital_expense'))
  );
