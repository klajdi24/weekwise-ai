-- Atomic quota consumption + Stripe webhook idempotency

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  created_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;

drop policy if exists stripe_webhook_events_no_client_read on public.stripe_webhook_events;
create policy stripe_webhook_events_no_client_read
  on public.stripe_webhook_events
  for select
  using (false);

create or replace function public.consume_ai_quota(p_user_id uuid, p_route text)
returns table (
  allowed boolean,
  usage_id uuid,
  plan text,
  period text,
  used int,
  limit_count int,
  remaining int,
  reset_at timestamptz,
  reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_plan text := 'free';
  v_status text := 'active';
  v_trial_ends_at timestamptz := null;
  v_current_start timestamptz := null;
  v_current_end timestamptz := null;
  v_period text := 'day';
  v_limit int := 5;
  v_used int := 0;
  v_window_start timestamptz;
  v_window_end timestamptz;
  v_usage_id uuid;
begin
  select s.plan, s.status, s.trial_ends_at, s.current_period_start, s.current_period_end
  into v_plan, v_status, v_trial_ends_at, v_current_start, v_current_end
  from public.subscriptions s
  where s.user_id = p_user_id;

  if v_plan is null then
    v_plan := 'free';
  end if;

  if v_plan = 'pro_trial' and (v_trial_ends_at is null or v_trial_ends_at <= v_now) then
    v_plan := 'free';
  end if;

  select l.period, l.actions_limit into v_period, v_limit
  from public.ai_limits l
  where l.plan = v_plan;

  if v_period is null then
    v_period := 'day';
    v_limit := 5;
  end if;

  if v_period = 'month' then
    v_window_start := coalesce(v_current_start, date_trunc('month', v_now));
    v_window_end := coalesce(v_current_end, v_window_start + interval '1 month');
  else
    v_window_start := date_trunc('day', v_now);
    v_window_end := v_window_start + interval '1 day';
  end if;

  select count(*)::int into v_used
  from public.ai_usage u
  where u.user_id = p_user_id
    and u.created_at >= v_window_start
    and u.created_at < v_window_end;

  if v_used >= v_limit then
    return query
    select false, null::uuid, v_plan, v_period, v_used, v_limit, 0, v_window_end, 'PLAN_LIMIT_REACHED'::text;
    return;
  end if;

  insert into public.ai_usage(user_id, route, request_tokens, response_tokens, total_tokens, cost_estimate)
  values (p_user_id, p_route, 0, 0, 0, 0)
  returning id into v_usage_id;

  v_used := v_used + 1;

  return query
  select true, v_usage_id, v_plan, v_period, v_used, v_limit, greatest(v_limit - v_used, 0), v_window_end, null::text;
end;
$$;

grant execute on function public.consume_ai_quota(uuid, text) to authenticated;
