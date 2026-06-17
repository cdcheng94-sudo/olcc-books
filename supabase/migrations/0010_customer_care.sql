-- 0010_customer_care.sql
-- Customer-success / after-sales 客户关怀 system.
-- Reminds the OLCC team to proactively check in on subscription customers
-- so EduFlow users stay happy and don't silently churn.
--
-- Anchored on subscriptions (each active subscription = one customer
-- relationship). Each subscription tracks when the next check-in is due,
-- the chosen interval, and a current health flag. check_ins is the log
-- (one row per check-in done, with the customer's feedback).

-- 1. Track the next check-in + health on the subscription itself (fast
--    "who's due" queries + current-state display).
alter table public.subscriptions
  add column if not exists next_checkin_date    date,
  add column if not exists checkin_interval_days int  not null default 7,
  add column if not exists health                text not null default 'healthy';
                                              -- 'healthy' | 'watch' | 'at_risk'

-- 2. Check-in history log (one row per check-in, with customer feedback).
create table if not exists public.check_ins (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  date            date not null,
  channel         text,                 -- 'call' | 'whatsapp' | 'visit' | 'email' | 'other'
  health          text,                 -- health recorded at this check-in
  feedback        text,                 -- what the customer said / satisfaction
  created_by      text,                 -- current user's email
  created_at      timestamptz not null default now()
);

create index if not exists check_ins_sub_idx on public.check_ins (subscription_id, date desc);

alter table public.check_ins enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='check_ins' and policyname='check_ins_authed_all') then
    create policy check_ins_authed_all on public.check_ins for all to authenticated using (true) with check (true);
  end if;
end $$;

-- 3. Backfill: existing active subscriptions enter the care loop with a
--    first check-in due a week out.
update public.subscriptions
   set next_checkin_date = current_date + 7
 where status = 'active'
   and next_checkin_date is null;
