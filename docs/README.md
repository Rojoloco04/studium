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
│       │       ├── layout.tsx
│       │       ├── page.tsx          # Overview
│       │       ├── settings/page.tsx # Canvas mgmt + theme toggle
│       │       ├── courses/
│       │       │   ├── page.tsx      # Grid view: all courses
│       │       │   └── [id]/page.tsx # Per-course detail + assignment list
│       │       ├── assignments/page.tsx
│       │       ├── grades/page.tsx   # Grade breakdown + final estimator
│       │       ├── planner/page.tsx
│       │       └── upload/page.tsx   # Syllabus PDF upload
│       ├── lib/
│       │   ├── supabase/
│       │   │   ├── client.ts         # Browser Supabase client
│       │   │   └── server.ts         # RSC/server-action client
│       │   ├── queries.ts            # React Query hooks (courses, allCourses, assignments, groups, toggleSubmitted, toggleHideCourse)
│       │   ├── types.ts              # Course, Assignment, AssignmentGroup types
│       │   ├── theme.tsx             # ThemeProvider (light/dark)
│       │   └── sync-provider.tsx     # SyncProvider — global Canvas sync state (syncing, triggerSync)
│       │   └── session-guard.tsx     # Persistent session handling
│       └── middleware.ts             # Auth route protection
└── backend/
    ├── main.py                       # FastAPI app + CORS
    ├── app/
    │   ├── api/
    │   │   ├── health.py             # GET /health
    │   │   └── canvas.py             # POST /connect, /sync; GET /status; DELETE /disconnect
    │   ├── core/
    │   │   ├── config.py             # Pydantic settings (reads .env)
    │   │   ├── auth.py               # JWT → user_id via Supabase
    │   │   ├── supabase.py           # Supabase service-role client
    │   │   └── encryption.py         # Fernet encrypt/decrypt for Canvas tokens
    │   ├── models/
    │   │   └── schemas.py            # Pydantic request/response models (incl. AssignmentGroup)
    │   └── services/
    │       └── canvas.py             # Canvas API client + sync logic (incl. assignment groups)
    └── supabase/
        └── schema.sql                # Full DB schema (run once in SQL editor)
```

## What's Built

### Backend
- **Canvas integration** — token validation, Fernet-encrypted storage, full course + assignment sync with pagination
- **Assignment groups** — syncs grade categories with weights per course; links assignments to their group
- **Submitted-mark preservation** — sync never flips a manually marked assignment back to unsubmitted
- **Auth** — Supabase JWT verification on every protected route (`Authorization: Bearer <token>`)
- **Config** — all secrets via `.env`, including `GEMINI_MODEL` (default: `gemini-2.0-flash-lite`)

### Frontend
- **Auth flows** — login, signup, route protection via middleware; `SessionGuard` for persistence
- **Courses page** — sortable grid (by name or grade), stat chips, color-coded grade badges, progress bars, upcoming assignment counts; each card links to a per-course detail page
- **Course detail page** (`/dashboard/courses/[id]`) — assignment list with filter tabs (All / Upcoming / Past Due / Submitted), grade summary bar, score display, submission-type icons, "Mark done" toggle with optimistic update
- **Grades page** — accordion per-course rows; per-category grade breakdown table (weights + contribution); interactive final grade estimator (what-if: enter final exam weight + running grade → see what you need for each letter)
- **Assignments page** — filter tabs (all/upcoming/past due/finished), per-course dropdown filter, color-coded due dates, "Mark done" toggle with optimistic update
- **Dashboard page** — live stat cards (course count, due this week, avg grade, at-risk); time-based greeting with first name; upcoming assignments list (next 5) with hover "Mark done"; contextual encouragement message; loading skeletons throughout
- **Settings page** — Canvas connection management (connect / sync now / disconnect) with toast notifications; light/dark theme toggle; hidden courses manager (unhide hidden courses)
- **Theme** — light mode default, dark mode via `[data-theme="dark"]`; `ThemeProvider` persists to `localStorage`
- **PWA metadata** — web manifest, icons, Apple Web App capable, theme color in `layout.tsx`
- **Toast notifications** — `sonner` library; triggered on sync success/failure
- **Course hiding** — hide courses from all views via hover button on course cards or course detail page; manage via Settings; `hidden boolean` column on `courses` table
- **Mobile layout** — responsive: fixed top header + slide-in drawer on mobile; desktop sidebar unchanged; `SyncProvider` exposes global `syncing` state and `triggerSync()` consumed by the layout spinner and Settings sync button
- **Nav order** — Dashboard → Courses → Assignments → Grades → Planner → Upload Syllabus

### Database
Tables: `canvas_tokens`, `courses` (incl. `hidden boolean`), `assignments`, `assignment_groups`, `syllabi`, `study_blocks`
- RLS enabled on all tables (users see only their own rows)
- `updated_at` triggers on mutable tables
- Indexes on `assignments(user_id, due_at)`, `assignments(course_id)`, `assignments(assignment_group_id)`, `assignment_groups(course_id)`, and `study_blocks(user_id, start_at)`

## What's Not Built Yet

- Gemini syllabus parser (service + `/api/syllabus` routes)
- Google Calendar sync
- Planner page
- Daily digest / AI-generated summary

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | — | Health check |
| POST | `/api/canvas/connect` | JWT | Validate token, store encrypted, initial sync |
| POST | `/api/canvas/sync` | JWT | Re-sync courses + assignments + assignment groups |
| GET | `/api/canvas/status` | JWT | Connection status, domain, username + counts |
| DELETE | `/api/canvas/disconnect` | JWT | Remove stored Canvas token |

