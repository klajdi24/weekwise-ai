-- Stripe subscription sync fields for billing settings + webhook reconciliation

alter table if exists public.subscriptions
  add column if not exists billing_interval text default 'monthly' check (billing_interval in ('monthly','annual')),
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

create index if not exists idx_subscriptions_stripe_customer_id on public.subscriptions(stripe_customer_id);
create index if not exists idx_subscriptions_stripe_subscription_id on public.subscriptions(stripe_subscription_id);
