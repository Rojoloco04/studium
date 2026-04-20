# Studium

AI-powered course tracker and study planner. Syncs with Canvas LMS, parses syllabi with Gemini, and schedules study blocks into Google Calendar.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| Backend | FastAPI + Python 3.12 |
| Database | Supabase (Postgres + Auth + Storage) |
| Auth | Supabase Auth (email + Google OAuth) |
| AI | Gemini 3.1 Flash Lite |
| Frontend deploy | Vercel |
| Backend deploy | Railway |

## Project Structure

```
studium/
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── page.tsx              # Landing
│       │   ├── login/page.tsx
│       │   ├── signup/page.tsx
│       │   └── dashboard/
│       │       ├── layout.tsx        # QueryClient + SyncProvider + PlannerProvider
│       │       ├── page.tsx          # Overview
│       │       ├── settings/page.tsx # Canvas mgmt + GCal connect + theme toggle
│       │       ├── courses/
│       │       │   ├── page.tsx      # Grid view: all courses
│       │       │   └── [id]/page.tsx # Per-course detail + assignment list
│       │       ├── assignments/page.tsx
│       │       ├── grades/page.tsx   # Grade breakdown + final estimator
│       │       ├── planner/page.tsx  # AI study planner + week calendar preview
│       │       └── upload/page.tsx   # Syllabus PDF upload
│       ├── lib/
│       │   ├── supabase/
│       │   │   ├── client.ts         # Browser Supabase client
│       │   │   └── server.ts         # RSC/server-action client
│       │   ├── queries.ts            # All React Query hooks — see Data Fetching below
│       │   ├── types.ts              # Shared TypeScript types
│       │   ├── theme.tsx             # ThemeProvider (light/dark)
│       │   ├── sync-provider.tsx     # Global Canvas sync state (syncing, triggerSync)
│       │   ├── planner-provider.tsx  # Global plan generation state (generating, triggerGenerate)
│       │   └── session-guard.tsx     # Persistent session handling
│       └── middleware.ts             # Auth route protection
└── backend/
    ├── main.py                       # FastAPI app + CORS
    ├── app/
    │   ├── api/
    │   │   ├── health.py             # GET /health
    │   │   ├── canvas.py             # POST /connect, /sync; GET /status; DELETE /disconnect
    │   │   └── google_calendar.py    # OAuth flow, preview/confirm plan, events, study blocks
    │   ├── core/
    │   │   ├── config.py             # Pydantic settings (reads .env)
    │   │   ├── auth.py               # JWT → user_id via Supabase
    │   │   ├── supabase.py           # Supabase service-role client
    │   │   └── encryption.py         # Fernet encrypt/decrypt for tokens
    │   ├── models/
    │   │   └── schemas.py            # Pydantic request/response models
    │   └── services/
    │       ├── canvas.py             # Canvas API client + sync logic
    │       ├── google_calendar.py    # GCal OAuth flow, token storage, event CRUD
    │       └── gemini.py             # Study plan generation (Gemini API)
    └── supabase/
        └── schema.sql                # Full DB schema (run once in SQL editor)
```

## What's Built

### Backend
- **Canvas integration** — token validation, Fernet-encrypted storage, full course + assignment sync with pagination
- **Assignment groups** — syncs grade categories with weights per course; links assignments to their group
- **Submitted-mark preservation** — sync never flips a manually marked assignment back to unsubmitted
- **Auth** — Supabase JWT verification on every protected route (`Authorization: Bearer <token>`)
- **Google Calendar OAuth** — PKCE flow; tokens encrypted at rest; access token auto-refreshed on expiry
- **Study plan generation** — Gemini reads upcoming assignments + existing calendar events, schedules non-overlapping sessions respecting the user's local timezone and prefs
- **Config** — all secrets via `.env`, including `GEMINI_MODEL` (default: `gemini-3.1-flash-lite-preview`)

### Frontend
- **Auth flows** — login, signup, Google OAuth, route protection via middleware; `SessionGuard` for persistence
  - Google OAuth redirect uses `NEXT_PUBLIC_SITE_URL` env var so deployed environments don't fall back to localhost
- **Courses page** — sortable grid (by name or grade), stat chips, color-coded grade badges, progress bars, upcoming assignment counts; each card links to a per-course detail page
- **Course detail page** (`/dashboard/courses/[id]`) — assignment list with filter tabs, grade summary bar, score display, "Mark done" toggle with optimistic update
- **Grades page** — accordion per-course rows; per-category grade breakdown (weights + contribution); interactive final grade estimator
- **Assignments page** — filter tabs (all/upcoming/past due/finished), per-course dropdown filter, color-coded due dates, "Mark done" toggle with optimistic update
- **Dashboard page** — live stat cards (course count, due this week, avg grade, at-risk); time-based greeting; upcoming assignments list with hover "Mark done"; loading skeletons
- **Settings page** — Canvas connection management + Google Calendar connect/disconnect; light/dark theme toggle; hidden courses manager
- **Study Planner page** — schedule window prefs (days ahead, start/end hour, max session length); week-view calendar always visible showing existing GCal events + proposed/confirmed study blocks; "Generate Study Plan" fires Gemini in the background via `PlannerProvider` (navigating away doesn't cancel it, toast fires on completion); proposed blocks shown as dashed-accent overlays on the calendar before confirmation
- **Theme** — light mode default, dark mode via `[data-theme="dark"]`; `ThemeProvider` persists to `localStorage`
- **PWA metadata** — web manifest, icons, Apple Web App capable, theme color
- **Course hiding** — hide/show courses from all views; manage via Settings
- **Mobile layout** — fixed top header + slide-in drawer; desktop sidebar unchanged

### Data Fetching

All data goes through React Query hooks in `lib/queries.ts` — never direct Supabase/API calls from components. The pattern:

1. **Fetch once** into the TanStack cache with an appropriate `staleTime`
2. **Update locally** via optimistic updates (`onMutate`) for immediate UI feedback
3. **POST on confirm** — single network write when the user commits (e.g. "Add to Calendar")

Key cache entries:

| Key | Source | `staleTime` | Notes |
|---|---|---|---|
| `['canvas', 'connected']` | Supabase | Infinity | Only changes on settings page |
| `['courses']` | Supabase | 5 min | Invalidated after Canvas sync |
| `['assignments']` | Supabase | 5 min | Optimistic toggle for submitted/hidden |
| `['google-calendar', 'connected']` | Supabase | Infinity | |
| `['study_blocks']` | Supabase | 5 min | Optimistic delete |
| `['calendar_events', days]` | Backend → GCal | 5 min | Seeded by preview-plan response; no extra round-trip |
| `['planner', 'preview']` | `PlannerProvider` | Infinity | Survives navigation; cleared on confirm or regenerate |

### Database
Tables: `canvas_tokens`, `courses` (incl. `hidden boolean`), `assignments`, `assignment_groups`, `google_tokens`, `syllabi`, `study_blocks`
- RLS enabled on all tables (users see only their own rows)
- `updated_at` triggers on mutable tables
- Indexes on `assignments(user_id, due_at)`, `assignments(course_id)`, `assignments(assignment_group_id)`, `assignment_groups(course_id)`, `study_blocks(user_id, start_at)`

## Environment Variables

### Backend (`.env`)

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS) |
| `GEMINI_API_KEY` | Google AI Studio API key |
| `GEMINI_MODEL` | Model name (default: `gemini-3.1-flash-lite-preview`) |
| `CANVAS_TOKEN_ENCRYPTION_KEY` | Fernet key for encrypting tokens at rest |
| `ALLOWED_ORIGINS` | CORS origins (comma-separated) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | Full callback URL — **must be set to Railway URL in production** |
| `FRONTEND_URL` | Frontend origin for post-OAuth redirects |

### Frontend (`.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `NEXT_PUBLIC_API_URL` | Backend URL (Railway in prod, `http://localhost:8000` in dev) |
| `NEXT_PUBLIC_SITE_URL` | Canonical frontend URL — **required in production** for correct Google OAuth redirect |

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | — | Health check |
| POST | `/api/canvas/connect` | JWT | Validate token, store encrypted, initial sync |
| POST | `/api/canvas/sync` | JWT | Re-sync courses + assignments + assignment groups |
| GET | `/api/canvas/status` | JWT | Connection status, domain, username + counts |
| DELETE | `/api/canvas/disconnect` | JWT | Remove stored Canvas token |
| GET | `/api/google-calendar/auth-url` | JWT | Get Google OAuth consent URL |
| GET | `/api/google-calendar/callback` | — | OAuth callback (user_id in PKCE state) |
| GET | `/api/google-calendar/status` | JWT | Connection status + Google email |
| DELETE | `/api/google-calendar/disconnect` | JWT | Remove stored GCal tokens |
| GET | `/api/google-calendar/events` | JWT | Upcoming calendar events (for UI display) |
| POST | `/api/google-calendar/preview-plan` | JWT | Generate Gemini study plan (no side effects) |
| POST | `/api/google-calendar/confirm-plan` | JWT | Push blocks to GCal + store in DB |
| GET | `/api/google-calendar/study-blocks` | JWT | List saved study blocks |
| DELETE | `/api/google-calendar/study-blocks/{id}` | JWT | Delete block + remove from GCal |
