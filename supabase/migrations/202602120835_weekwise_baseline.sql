-- WeekWiseAI baseline schema + RLS scaffold
-- Source-of-truth baseline from product decisions (2026-02-12)

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  university text,
  course text,
  year int,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  notes text,
  due_at timestamptz,
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  status text not null default 'todo' check (status in ('todo','doing','done')),
  xp_reward int not null default 10,
  created_at timestamptz not null default now()
);

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  duration_min int not null,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_streak int not null default 0,
  best_streak int not null default 0,
  last_active_date date,
  streak_freeze_count int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.xp_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null,
  points int not null,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','pro_trial','pro')),
  trial_ends_at timestamptz,
  status text not null default 'active',
  updated_at timestamptz not null default now()
);

-- Optional analytics table for product events
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  event_name text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_tasks_user_due on public.tasks(user_id, due_at);
create index if not exists idx_tasks_user_status on public.tasks(user_id, status);
create index if not exists idx_study_sessions_user_starts on public.study_sessions(user_id, starts_at);
create index if not exists idx_xp_ledger_user_created on public.xp_ledger(user_id, created_at desc);
create index if not exists idx_subscriptions_user_plan on public.subscriptions(user_id, plan);
create index if not exists idx_analytics_user_event_created on public.analytics_events(user_id, event_name, created_at desc);

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.study_sessions enable row level security;
alter table public.streaks enable row level security;
alter table public.xp_ledger enable row level security;
alter table public.subscriptions enable row level security;
alter table public.analytics_events enable row level security;

-- Profiles policies (id = auth.uid())
drop policy if exists profiles_own_select on public.profiles;
create policy profiles_own_select on public.profiles for select using (id = auth.uid());
drop policy if exists profiles_own_insert on public.profiles;
create policy profiles_own_insert on public.profiles for insert with check (id = auth.uid());
drop policy if exists profiles_own_update on public.profiles;
create policy profiles_own_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists profiles_own_delete on public.profiles;
create policy profiles_own_delete on public.profiles for delete using (id = auth.uid());

-- user_id = auth.uid() policies for user-owned tables

drop policy if exists tasks_own_select on public.tasks;
create policy tasks_own_select on public.tasks for select using (user_id = auth.uid());
drop policy if exists tasks_own_insert on public.tasks;
create policy tasks_own_insert on public.tasks for insert with check (user_id = auth.uid());
drop policy if exists tasks_own_update on public.tasks;
create policy tasks_own_update on public.tasks for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists tasks_own_delete on public.tasks;
create policy tasks_own_delete on public.tasks for delete using (user_id = auth.uid());

drop policy if exists study_sessions_own_select on public.study_sessions;
create policy study_sessions_own_select on public.study_sessions for select using (user_id = auth.uid());
drop policy if exists study_sessions_own_insert on public.study_sessions;
create policy study_sessions_own_insert on public.study_sessions for insert with check (user_id = auth.uid());
drop policy if exists study_sessions_own_update on public.study_sessions;
create policy study_sessions_own_update on public.study_sessions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists study_sessions_own_delete on public.study_sessions;
create policy study_sessions_own_delete on public.study_sessions for delete using (user_id = auth.uid());

drop policy if exists streaks_own_select on public.streaks;
create policy streaks_own_select on public.streaks for select using (user_id = auth.uid());
drop policy if exists streaks_own_insert on public.streaks;
create policy streaks_own_insert on public.streaks for insert with check (user_id = auth.uid());
drop policy if exists streaks_own_update on public.streaks;
create policy streaks_own_update on public.streaks for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists streaks_own_delete on public.streaks;
create policy streaks_own_delete on public.streaks for delete using (user_id = auth.uid());

drop policy if exists xp_ledger_own_select on public.xp_ledger;
create policy xp_ledger_own_select on public.xp_ledger for select using (user_id = auth.uid());
drop policy if exists xp_ledger_own_insert on public.xp_ledger;
create policy xp_ledger_own_insert on public.xp_ledger for insert with check (user_id = auth.uid());
drop policy if exists xp_ledger_own_update on public.xp_ledger;
create policy xp_ledger_own_update on public.xp_ledger for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists xp_ledger_own_delete on public.xp_ledger;
create policy xp_ledger_own_delete on public.xp_ledger for delete using (user_id = auth.uid());

drop policy if exists subscriptions_own_select on public.subscriptions;
create policy subscriptions_own_select on public.subscriptions for select using (user_id = auth.uid());
drop policy if exists subscriptions_own_insert on public.subscriptions;
create policy subscriptions_own_insert on public.subscriptions for insert with check (user_id = auth.uid());
drop policy if exists subscriptions_own_update on public.subscriptions;
create policy subscriptions_own_update on public.subscriptions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists subscriptions_own_delete on public.subscriptions;
create policy subscriptions_own_delete on public.subscriptions for delete using (user_id = auth.uid());

drop policy if exists analytics_events_own_select on public.analytics_events;
create policy analytics_events_own_select on public.analytics_events for select using (user_id = auth.uid());
drop policy if exists analytics_events_own_insert on public.analytics_events;
create policy analytics_events_own_insert on public.analytics_events for insert with check (user_id = auth.uid());
drop policy if exists analytics_events_own_update on public.analytics_events;
create policy analytics_events_own_update on public.analytics_events for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists analytics_events_own_delete on public.analytics_events;
create policy analytics_events_own_delete on public.analytics_events for delete using (user_id = auth.uid());
