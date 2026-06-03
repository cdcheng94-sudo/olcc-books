-- 0007_capital_pools.sql
-- Capital / Operating dual-fund-pool 改造
--
-- 在 Supabase SQL Editor 跑（确认在 olcc-books / wfrzuzjbonmaulzufrdu project）。
-- 幂等：可重复跑。建 shareholders 表、扩展 transactions.type 为 6 种、
-- 加 shareholder_id / loan_type / interest_rate、category 改可空、加完整性约束。

-- =====================================================================
-- 1. shareholders（股东 / Director's Loan Account 的主体）
-- =====================================================================
create table if not exists public.shareholders (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

alter table public.shareholders enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'shareholders' and policyname = 'shareholders_authed_all'
  ) then
    create policy shareholders_authed_all
      on public.shareholders for all to authenticated using (true) with check (true);
  end if;
end $$;

-- =====================================================================
-- 2. transactions.type 扩展为 6 种
--    旧的 type check 在 0001 里是 inline 定义、名字自动生成，所以这里
--    动态查出它的真名再删，避免硬编码名字对不上。
-- =====================================================================
do $$
declare cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.transactions'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%type%in%';
  if cname is not null then
    execute format('alter table public.transactions drop constraint %I', cname);
  end if;
end $$;

alter table public.transactions
  add constraint transactions_type_check
  check (type in ('income','expense','capital_injection','capital_expense','loan_repayment','interest_paid'));

-- =====================================================================
-- 3. 新字段
--    shareholder_id — capital_injection / loan_repayment / interest_paid 必填
--    loan_type      — 仅 capital_injection 用（director_loan / paid_up_capital / other）
--    interest_rate  — 预留，capital_injection 用，现在不参与计算
-- =====================================================================
alter table public.transactions add column if not exists shareholder_id uuid references public.shareholders(id) on delete restrict;
alter table public.transactions add column if not exists loan_type      text;
alter table public.transactions add column if not exists interest_rate  numeric(6,2) not null default 0;

-- =====================================================================
-- 4. category 改为可空
--    capital_injection / loan_repayment / interest_paid 没有"分类"概念 → NULL
--    capital_expense 把它的 Renovation/Equipment 等存进 category
--    income / expense 仍在应用层强制要分类
-- =====================================================================
alter table public.transactions alter column category drop not null;

-- =====================================================================
-- 5. 完整性约束：这三种 type 必须带 shareholder_id
--    （"不能凭空冒出还款/利息"靠应用层算 outstanding 再额外把关）
-- =====================================================================
alter table public.transactions drop constraint if exists transactions_shareholder_required;
alter table public.transactions add constraint transactions_shareholder_required
  check (
    (type in ('capital_injection','loan_repayment','interest_paid') and shareholder_id is not null)
    or
    (type in ('income','expense','capital_expense'))
  );

-- =====================================================================
-- 6. 索引
-- =====================================================================
create index if not exists transactions_shareholder_idx on public.transactions (shareholder_id);
