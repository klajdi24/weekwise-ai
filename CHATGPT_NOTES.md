# CHATGPT_NOTES.md

Source: https://chatgpt.com/share/698956b6-1628-800f-a0c0-0ae28c8f518b
Imported: 2026-02-09

## Project context extracted

- App name: **WeekWise AI**
- Mission: AI-assisted productivity app for university students (schedule + fitness + study support)
- Stack: Next.js (App Router), Tailwind, OpenAI, Supabase, GitHub, Vercel

## Feature intentions from prior chat

1. **Home page**
   - Links to Schedule, Fitness, PDF Summarizer, Profile
   - Shared Navbar/Footer via `layout.tsx`

2. **Schedule page**
   - Add lectures/assignments/events
   - AI-generated schedule optimization + study sessions before assignments
   - Weekly grid rendering
   - Inputs: title, type, day, start hour, duration

3. **Fitness page**
   - Log workouts + steps + basic progress tracking

4. **PDF summarizer**
   - Upload PDF and summarize with OpenAI

5. **Profile page**
   - Account/settings handling

## Known issues captured in prior chat

- Historical duplicate navbar issue (fixed via layout-level navbar/footer)
- AI schedule not fully complete previously
- Styling/setup issues on Windows in prior setup
- Production PDF summarizer depends on correct OpenAI env vars in deployment

## Notes relevant to current implementation

- Prior chat mentioned monetization direction and premium/free feature gating.
- Existing code in this repo already includes free-limit + premium checks around AI usage (profiles table fields).
- Prior snippet used OpenAI schedule route with strict JSON response and server-side sanitization.

## Reliability caution

- Shared-chat content extraction may contain encoding artifacts.
- Treat this file as guidance; codebase reality remains source of truth.
