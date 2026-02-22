# WeekWise AI — Phase 0 Audit (2026-02-09)

## Architecture summary
- Framework: Next.js App Router + TypeScript (`app/*`)
- UI: Tailwind CSS
- Auth/data: Supabase client-side auth + row reads/writes from browser
- AI endpoints:
  - `POST /api/ai/schedule`
  - `POST /api/ai/suggest`
  - `POST /api/ai/summarize`
  - `POST /api/ai/weekly-summary`
- Domain tables currently implied in app code:
  - `profiles` (`id`, `is_premium`, `ai_usage_count`)
  - `events` (`id`, `user_id`, `title`, `type`, `day`, `start_hour`, `duration`)
  - `workouts` (`id`, `user_id`, `name`, `date`, `duration`, `steps`)

## Launch gap report

### Critical
1. Missing reward system (XP/levels/streaks/badges/milestones) end-to-end.
2. No explicit DB migrations in repo (schema drift risk across environments).
3. RLS hardening not codified in versioned SQL.

### High
1. Inconsistent flow quality/loading/error states across pages.
2. No test suite for core logic and no CI-like verification script coverage.
3. API safety baseline is partial (good auth checks on some AI endpoints, but no centralized validation/idempotency).

### Medium
1. Accessibility consistency gaps (focus states, semantic labels, feedback regions).
2. UX motivation loop is shallow (no clear progression HUD, celebrations, daily goals).
3. Duplicate/legacy page patterns (layout duplication remnants, placeholder notes generator).

### Low
1. Minor UI polish inconsistencies.
2. Legacy comments and formatting noise.

## Prioritized roadmap
1. **Stabilize baseline (Phase 1)**
   - Remove lint/type issues and duplicate layout usage.
   - Normalize page states and error handling.
2. **Supabase hardening (Phase 2)**
   - Add versioned SQL migrations for existing entities.
   - Add/verify RLS + indexes + constraints.
3. **Mandatory rewards (Phase 3)**
   - New schema + services + UI for XP/levels/streak/badges/history.
   - Idempotent reward awarding + anti-abuse controls.
4. **Motivational UX (Phase 4)**
   - Progress HUD, streak callouts, milestone celebrations.
5. **Reliability/performance/security (Phase 5)**
   - Validation guards, duplicate-submit guards, fetch/async resilience.
6. **Analytics + observability (Phase 6)**
   - Track key product events without sensitive payload leakage.
7. **Release readiness (Phase 7)**
   - Unit + integration tests, launch/rollback checklists.

## Environment/config baseline
- `.env.example` was missing and is now added.
- No secrets exposed during audit.

## 2026-02-10 addendum
- A new `momentum` route exists with front-end motivational shell, but no persistent gamification backend yet.
- Current premium gating is usage-count based on `profiles.is_premium` + `profiles.ai_usage_count` and does not include Stripe entitlements.
- No Stripe routes/webhooks in repo yet.
- Immediate highest-impact gap remains: server-backed XP/streak/level model with persistence and abuse protection.
