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
│       ├── lib/       # Supabase clients (client.ts, server.ts)
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

- Canvas connect/sync/status endpoints (JWT-authenticated)
- Fernet encryption of Canvas tokens at rest
- Full course + assignment sync with Canvas pagination
- All dashboard pages scaffolded (courses, assignments, grades, planner, upload)
- Auth flows (login, signup, middleware-based route protection)

## Not yet built

- Gemini syllabus parser
- Google Calendar sync
- Grade estimator / feedback loop

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
- Environment: backend uses `.env`, frontend uses `.env.local`
