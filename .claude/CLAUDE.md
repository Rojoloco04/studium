# Studium

AI-powered course tracker and study planner.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| Backend | FastAPI + Python 3.12 |
| Database | Supabase (Postgres) |
| Auth | Supabase Auth (email + Google OAuth) |
| AI | Gemini 2.0 Flash Lite |
| Frontend deploy | Vercel |
| Backend deploy | Railway |

## Structure

```
studium/
├── frontend/          # Next.js app → Vercel
│   └── src/
│       ├── app/       # App Router pages (landing, login, signup, dashboard/*)
│       ├── lib/       # Supabase clients, theme.tsx, session-guard.tsx
│       └── middleware.ts
├── backend/           # FastAPI → Railway
│   ├── app/
│   │   ├── api/       # health.py, canvas.py
│   │   ├── core/      # config.py, auth.py, supabase.py, encryption.py
│   │   ├── models/    # schemas.py (Pydantic)
│   │   └── services/  # canvas.py (API client + sync logic)
│   ├── supabase/
│   │   └── schema.sql # Run once in Supabase SQL editor
│   └── main.py
└── docs/
    └── README.md
```

## What's built

- Canvas connect/sync/status/disconnect endpoints (JWT-authenticated)
- Fernet encryption of Canvas tokens at rest
- Full course + assignment + assignment group sync with Canvas pagination
- Assignment groups (grade categories with weights) synced per course; sync preserves manually marked submissions
- Courses page — sortable grid view; each card links to a per-course detail page (`/dashboard/courses/[id]`)
- Course detail page — assignment list with filter tabs, grade summary bar, score display, "Mark done" toggle with optimistic update
- Grades page — accordion per-course rows; per-category breakdown (weights + contribution); interactive final grade estimator
- Settings page — Canvas connect/sync/disconnect with toast notifications (`sonner`); theme toggle
- Auth flows (login, signup, middleware-based route protection)
- Light/dark theme via `ThemeProvider` (`lib/theme.tsx`); CSS vars split into `:root` (light) and `[data-theme="dark"]`
- `SessionGuard` (`lib/session-guard.tsx`) for persistent session handling
- PWA metadata (manifest, icons, Apple Web App, theme color) in `layout.tsx`
- React Query hooks in `lib/queries.ts`: `useCourses`, `useAllCourses`, `useAssignments`, `useAssignmentGroups`, `useCanvasConnected`, `useToggleSubmitted`, `useToggleHideCourse`, `useGoogleCalendarConnected`, `useStudyBlocks`, `useCalendarEvents`, `usePlannerPreview`, `usePreviewStudyPlan`, `useConfirmStudyPlan`, `useDeleteStudyBlock`
- Assignments page — filter tabs (all/upcoming/past due/finished), per-course dropdown filter, "Mark done" toggle with optimistic update, color-coded due dates
- Dashboard page — live stat cards (course count, due this week, avg grade, at-risk); time-based greeting with first name; upcoming assignments list with hover "Mark done"; contextual encouragement message; loading skeletons throughout
- Course hiding — `hidden boolean` column on `courses` table; hide button on course cards (hover) and course detail page; hidden courses manager in Settings to unhide; hidden courses filtered from all views and assignment lists
- Mobile-responsive layout — fixed top header + slide-in drawer on mobile; desktop sidebar unchanged; `SyncProvider` (`lib/sync-provider.tsx`) provides global sync state (`syncing`, `triggerSync`) consumed by layout spinner and Settings sync button
- Nav order: Dashboard → Courses → Assignments → Grades → Planner → Upload Syllabus
- Google Calendar OAuth — PKCE flow; tokens Fernet-encrypted at rest; auto-refresh on expiry; connect/disconnect in Settings
- Study Planner — scheduling prefs (days ahead, local-time window, max session length); `PlannerProvider` (`lib/planner-provider.tsx`) runs Gemini generation globally so navigation away doesn't cancel it; toast on completion; proposed blocks cached in TanStack (`QK.plannerPreview`, survives navigation); week-view `WeekCalendar` component always visible showing existing GCal events (gray) + proposed (dashed accent) + confirmed (solid accent) blocks; prefs persisted in `localStorage`
- Timezone-aware scheduling — browser timezone detected via `Intl.DateTimeFormat().resolvedOptions().timeZone` and sent with every plan request; Gemini prompt uses the resolved UTC offset so sessions are scheduled in local time, not UTC
- OAuth redirect fix — Google sign-in uses `NEXT_PUBLIC_SITE_URL` env var so deployed builds redirect to the correct domain instead of Supabase's configured Site URL

## Not yet built

- Gemini syllabus parser
- Daily digest / AI-generated summary

## Dev

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload   # http://localhost:8000

# Frontend
cd frontend
npm install
cp .env.local.example .env.local
npm run dev                 # http://localhost:3000
```

## Key conventions

- Backend routes live under `app/api/`, thin handlers delegating to `app/services/`
- All protected routes depend on `get_current_user_id` which reads `Authorization: Bearer <supabase_jwt>`
- Frontend fetches must include the Supabase session access token as the Bearer token
- Supabase client helpers: `frontend/src/lib/supabase/client.ts` (browser) and `server.ts` (RSC/server actions)
- Canvas access tokens are Fernet-encrypted at rest (`app/core/encryption.py`)
- Gemini model name lives in config: `settings.gemini_model` (default `gemini-2.0-flash-lite`)
- Theme is controlled by `data-theme` attribute on `<html>`; `ThemeProvider` reads/writes `localStorage`
- Environment: backend uses `.env`, frontend uses `.env.local`
