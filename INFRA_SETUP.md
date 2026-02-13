# Infra Setup (Safe Mode)

## 1) Supabase migration apply

Run in Supabase SQL editor (or CLI):

- `supabase/migrations/202602120835_weekwise_baseline.sql`

Verify:
- Tables exist: `profiles, tasks, study_sessions, streaks, xp_ledger, subscriptions, analytics_events`
- RLS is ON for each table
- Policies exist and are own-row scoped via `auth.uid()`

## 2) Stripe test-mode wiring

Set env vars (test keys only):
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_PRO_MONTHLY`
- `NEXT_PUBLIC_APP_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Create webhook endpoint (test mode):
- URL: `https://<your-domain>/api/billing/webhook`
- Events:
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

Verify:
- `POST /api/billing/checkout` returns a Checkout URL for logged-in user
- Completing test checkout updates `subscriptions` row
- Trial starts as `pro_trial`, active becomes `pro`

## 3) Vercel env + deploy readiness

In Vercel Project Settings -> Environment Variables, add:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `STRIPE_SECRET_KEY` (test)
- `STRIPE_WEBHOOK_SECRET` (test)
- `STRIPE_PRICE_PRO_MONTHLY` (test)
- `NEXT_PUBLIC_APP_URL` (production URL)

Recommended deploy checks:
1. Deploy preview builds cleanly
2. `/api/subscription/status` returns expected plan/quota
3. `/api/billing/checkout` creates test checkout
4. Stripe webhook events update Supabase `subscriptions`

## Safety notes
- Never commit real secrets
- Never expose service role in client code
- Keep Stripe in test mode until explicit live approval
