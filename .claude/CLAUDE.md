# Studium

AI-powered course tracker and study planner.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| Backend | FastAPI + Python 3.12 |
| Database | Supabase (Postgres) |
| Auth | Supabase Auth (email + Google OAuth) |
| AI | Gemini 3.1 Flash Lite |
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
- React Query hooks in `lib/queries.ts`: `useCourses`, `useAssignments`, `useAssignmentGroups`, `useCanvasConnected`, `useToggleSubmitted`
- Assignments page — filter tabs (all/upcoming/past due/finished), per-course dropdown filter, "Mark done" toggle with optimistic update, color-coded due dates
- Dashboard page — live stat cards (course count, due this week, avg grade, at-risk); time-based greeting with first name; upcoming assignments list; contextual encouragement message; loading skeletons throughout

## Not yet built

- Gemini syllabus parser
- Google Calendar sync
- Planner page
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
- Gemini model name lives in config: `settings.gemini_model` (default `gemini-3.1-flash-lite`)
- Theme is controlled by `data-theme` attribute on `<html>`; `ThemeProvider` reads/writes `localStorage`
- Environment: backend uses `.env`, frontend uses `.env.local`
