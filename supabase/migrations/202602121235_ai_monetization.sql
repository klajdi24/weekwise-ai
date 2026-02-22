-- AI monetization: capped usage + fair-use guardrails

create extension if not exists pgcrypto;

-- Harden subscriptions schema for period-aware limits
alter table if exists public.subscriptions
  add column if not exists current_period_start timestamptz,
  add column if not exists current_period_end timestamptz;

-- Keep existing checks but ensure defaults exist
alter table if exists public.subscriptions
  alter column plan set default 'free',
  alter column status set default 'active',
  alter column updated_at set default now();

-- Usage ledger per AI call
create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  route text not null,
  request_tokens int not null default 0,
  response_tokens int not null default 0,
  total_tokens int not null default 0,
  cost_estimate numeric(10,6) not null default 0,
  created_at timestamptz not null default now()
);

-- Plan limits config
create table if not exists public.ai_limits (
  plan text primary key,
  period text not null check (period in ('day','month')),
  actions_limit int not null check (actions_limit > 0)
);

insert into public.ai_limits(plan, period, actions_limit)
values
  ('free', 'day', 5),
  ('pro_trial', 'month', 400),
  ('pro', 'month', 400)
on conflict (plan) do update set
  period = excluded.period,
  actions_limit = excluded.actions_limit;

create index if not exists idx_ai_usage_user_created_desc on public.ai_usage(user_id, created_at desc);
create index if not exists idx_ai_usage_user_route_created_desc on public.ai_usage(user_id, route, created_at desc);

alter table public.ai_usage enable row level security;
alter table public.ai_limits enable row level security;

-- End users can read only their own usage rows; service role bypasses via postgres privileges.
drop policy if exists ai_usage_own_select on public.ai_usage;
create policy ai_usage_own_select on public.ai_usage
  for select
  using (user_id = auth.uid());

drop policy if exists ai_usage_own_insert on public.ai_usage;
create policy ai_usage_own_insert on public.ai_usage
  for insert
  with check (user_id = auth.uid());

-- ai_limits is read-only to authenticated users (plan catalog)
drop policy if exists ai_limits_read_authenticated on public.ai_limits;
create policy ai_limits_read_authenticated on public.ai_limits
  for select
  using (auth.role() = 'authenticated');

-- subscriptions row-isolation safety refresh (idempotent)
drop policy if exists subscriptions_own_select on public.subscriptions;
create policy subscriptions_own_select on public.subscriptions
  for select
  using (user_id = auth.uid());

drop policy if exists subscriptions_own_insert on public.subscriptions;
create policy subscriptions_own_insert on public.subscriptions
  for insert
  with check (user_id = auth.uid());

drop policy if exists subscriptions_own_update on public.subscriptions;
create policy subscriptions_own_update on public.subscriptions
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists subscriptions_own_delete on public.subscriptions;
create policy subscriptions_own_delete on public.subscriptions
  for delete
  using (user_id = auth.uid());
