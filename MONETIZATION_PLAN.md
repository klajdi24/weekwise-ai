# MONETIZATION_PLAN.md — Trial + Subscription Logic

## Plan
- Product: WeekWise AI Premium
- Billing: Monthly subscription
- Trial: 7-day default (configurable)

## Entitlements
- `free`: capped AI usage + limited motivation features
- `premium_trial`: all premium features until trial_end
- `premium_active`: all premium features while subscription active
- `premium_grace`: temporary grace window after payment failure
- `premium_canceled`: access until period end, then downgrade

## Stripe integration components
1. Checkout Session route (creates trial subscription)
2. Customer Portal route (manage/cancel/resume)
3. Webhook route (source of truth)
4. Idempotency table for webhook event ids

## Supabase billing fields (proposed)
- `profiles.stripe_customer_id`
- `profiles.stripe_subscription_id`
- `profiles.subscription_status`
- `profiles.trial_ends_at`
- `profiles.current_period_end`
- `profiles.cancel_at_period_end`

## Edge cases
- Trial started then canceled same day
- Webhook retries (must be idempotent)
- Downgrade after period end
- Subscription resumed before end date
- Missing customer mapping recovery

## Conversion surfaces
- In-context paywall after free AI limit
- Premium badges + unlock copy in Profile/Momentum
- Trial CTA from Schedule + Momentum
