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
│       │   ├── queries.ts            # React Query hooks (courses, assignments, groups, toggle)
│       │   ├── types.ts              # Course, Assignment, AssignmentGroup types
│       │   ├── theme.tsx             # ThemeProvider (light/dark)
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
- **Config** — all secrets via `.env`, including `GEMINI_MODEL` (default: `gemini-3.1-flash-lite`)

### Frontend
- **Auth flows** — login, signup, route protection via middleware; `SessionGuard` for persistence
- **Courses page** — sortable grid (by name or grade), stat chips, color-coded grade badges, progress bars, upcoming assignment counts; each card links to a per-course detail page
- **Course detail page** (`/dashboard/courses/[id]`) — assignment list with filter tabs (All / Upcoming / Past Due / Submitted), grade summary bar, score display, submission-type icons, "Mark done" toggle with optimistic update
- **Grades page** — accordion per-course rows; per-category grade breakdown table (weights + contribution); interactive final grade estimator (what-if: enter final exam weight + running grade → see what you need for each letter)
- **Settings page** — Canvas connection management (connect / sync now / disconnect) with toast notifications; light/dark theme toggle
- **Theme** — light mode default, dark mode via `[data-theme="dark"]`; `ThemeProvider` persists to `localStorage`
- **PWA metadata** — web manifest, icons, Apple Web App capable, theme color in `layout.tsx`
- **Toast notifications** — `sonner` library; triggered on sync success/failure

### Database
Tables: `canvas_tokens`, `courses`, `assignments`, `assignment_groups`, `syllabi`, `study_blocks`
- RLS enabled on all tables (users see only their own rows)
- `updated_at` triggers on mutable tables
- Indexes on `assignments(user_id, due_at)`, `assignments(course_id)`, `assignments(assignment_group_id)`, `assignment_groups(course_id)`, and `study_blocks(user_id, start_at)`

## What's Not Built Yet

- Gemini syllabus parser (service + `/api/syllabus` routes)
- Google Calendar sync
- Assignments page (live data)
- Dashboard overview stat cards (live data)
- Planner page

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run `backend/supabase/schema.sql` in the SQL editor
3. Enable Google OAuth under Authentication → Providers
4. Add your site URL and redirect URLs under Authentication → URL Configuration

### 2. Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Fill in .env:
#   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
#   GEMINI_API_KEY
#   CANVAS_TOKEN_ENCRYPTION_KEY  (see below)
#   FRONTEND_URL

# Generate Fernet key:
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

uvicorn main:app --reload   # http://localhost:8000, docs at /docs
```

### 3. Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
# Fill in: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_API_URL
npm run dev   # http://localhost:3000
```

### 4. Connect Canvas

1. Log into Canvas → Account → Settings → Approved Integrations → + New Access Token
2. Name it "Studium", copy the token
3. In the app: Dashboard → Settings → enter your domain + token

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | — | Health check |
| POST | `/api/canvas/connect` | JWT | Validate token, store encrypted, initial sync |
| POST | `/api/canvas/sync` | JWT | Re-sync courses + assignments + assignment groups |
| GET | `/api/canvas/status` | JWT | Connection status, domain, username + counts |
| DELETE | `/api/canvas/disconnect` | JWT | Remove stored Canvas token |

## Deployment

### Backend → Railway

1. Push repo to GitHub, create Railway project → Deploy from GitHub
2. Set env vars in Railway dashboard (same as `.env`)
3. Railway auto-detects and builds

### Frontend → Vercel

1. Import repo, set root to `frontend/`
2. Set env vars: Supabase URL, anon key, Railway backend URL
3. Deploy
