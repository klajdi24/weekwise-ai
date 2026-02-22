# DELIVERY_PLAN.md — WeekWise AI Launch Plan

## Milestone 1 (Visible UX + Motivation Shell)
**Acceptance criteria**
- Profile and Schedule show clear progress UI (XP, streak, level, goals, badges preview)
- At least one celebration interaction (level-up style feedback) visible in UI
- Loading/empty/error states implemented for touched screens

## Milestone 2 (Subscription + Trial)
**Acceptance criteria**
- Stripe checkout session route + customer portal route
- Trial metadata + entitlement helper wired
- Premium paywall state visible in UI
- Webhook skeleton with idempotency key storage

## Milestone 3 (Gamification Engine)
**Acceptance criteria**
- Server-side XP award function with idempotency
- Streak update logic with freeze support
- Badge unlock evaluation + storage
- Backfill/recalc utility

## Milestone 4 (Security + Launch Readiness)
**Acceptance criteria**
- Supabase RLS SQL in versioned migrations
- Legal pages scaffolded (Terms/Privacy/Subscription/Refund placeholder)
- Analytics events added to critical funnel points
- QA + release + rollback checklists in repo

## Delivery cadence
- 20-minute cycles with proof outputs
- Lint + build on each cycle before completion claim
- No status-only messages
