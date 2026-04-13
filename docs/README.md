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
│       │       ├── canvas/page.tsx   # Canvas setup
│       │       ├── courses/page.tsx
│       │       ├── assignments/page.tsx
│       │       ├── grades/page.tsx
│       │       ├── planner/page.tsx
│       │       └── upload/page.tsx   # Syllabus PDF upload
│       ├── lib/supabase/
│       │   ├── client.ts             # Browser Supabase client
│       │   └── server.ts             # RSC/server-action client
│       └── middleware.ts             # Auth route protection
└── backend/
    ├── main.py                       # FastAPI app + CORS
    ├── app/
    │   ├── api/
    │   │   ├── health.py             # GET /health
    │   │   └── canvas.py             # POST /api/canvas/connect, /sync, GET /status
    │   ├── core/
    │   │   ├── config.py             # Pydantic settings (reads .env)
    │   │   ├── auth.py               # JWT → user_id via Supabase
    │   │   ├── supabase.py           # Supabase service-role client
    │   │   └── encryption.py         # Fernet encrypt/decrypt for Canvas tokens
    │   ├── models/
    │   │   └── schemas.py            # Pydantic request/response models
    │   └── services/
    │       └── canvas.py             # Canvas API client + sync logic
    └── supabase/
        └── schema.sql                # Full DB schema (run once in SQL editor)
```

## What's Built

### Backend
- **Canvas integration** — token validation, Fernet-encrypted storage, full course + assignment sync with pagination
- **Auth** — Supabase JWT verification on every protected route (`Authorization: Bearer <token>`)
- **Config** — all secrets via `.env`, including `GEMINI_MODEL` (default: `gemini-3.1-flash-lite`)

### Frontend
- **Auth flows** — login, signup, route protection via middleware
- **Dashboard** — overview, courses, assignments, grades, planner, syllabus upload pages (UI scaffolded)
- **Canvas setup** — domain + token form, sends JWT to backend

### Database
Tables: `canvas_tokens`, `courses`, `assignments`, `syllabi`, `study_blocks`
- RLS enabled on all tables (users see only their own rows)
- `updated_at` triggers on mutable tables
- Indexes on `assignments(user_id, due_at)` and `study_blocks(user_id, start_at)`

## What's Not Built Yet

- Gemini syllabus parser (service + `/api/syllabus` routes)
- Google Calendar sync
- Grade estimator / feedback loop
- Live data on dashboard stat cards

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
3. In the app: Dashboard → Canvas Setup → enter your domain + token

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | — | Health check |
| POST | `/api/canvas/connect` | JWT | Validate token, store encrypted, initial sync |
| POST | `/api/canvas/sync` | JWT | Re-sync courses + assignments |
| GET | `/api/canvas/status` | JWT | Connection status + counts |

## Deployment

### Backend → Railway

1. Push repo to GitHub, create Railway project → Deploy from GitHub
2. Set env vars in Railway dashboard (same as `.env`)
3. Railway auto-detects and builds

### Frontend → Vercel

1. Import repo, set root to `frontend/`
2. Set env vars: Supabase URL, anon key, Railway backend URL
3. Deploy
