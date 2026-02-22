-- Plan tiers update: free/pro/unlimited with monthly quotas + fair-use support

alter table if exists public.subscriptions
  drop constraint if exists subscriptions_plan_check;

alter table if exists public.subscriptions
  add constraint subscriptions_plan_check
  check (plan in ('free','pro','unlimited'));

insert into public.ai_limits(plan, period, actions_limit)
values
  ('free', 'month', 60),
  ('pro', 'month', 500),
  ('unlimited', 'month', 1000000)
on conflict (plan) do update set
  period = excluded.period,
  actions_limit = excluded.actions_limit;

-- Keep legacy plan rows compatible if they exist
update public.subscriptions
set plan = 'pro'
where plan = 'pro_trial';
