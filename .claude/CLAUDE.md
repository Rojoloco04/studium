# Studium

AI-powered course tracker and study planner.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| Backend | FastAPI + Python 3.12 |
| Database | Supabase (Postgres) |
| Auth | Supabase Auth (email + Google OAuth) |
| AI | Gemini 2.5 Flash / Pro |
| Frontend deploy | Vercel |
| Backend deploy | Railway |

## Structure

```
studium/
├── frontend/          # Next.js app → Vercel
│   ├── src/
│   │   ├── app/       # App Router pages + layouts
│   │   ├── lib/       # Supabase clients (client.ts, server.ts)
│   │   └── middleware.ts
│   └── public/        # PWA manifest, icons
├── backend/           # FastAPI → Railway
│   ├── app/
│   │   ├── api/       # Route handlers (canvas, health)
│   │   ├── core/      # Config, auth, supabase client, encryption
│   │   ├── models/    # Pydantic schemas
│   │   └── services/  # Canvas service logic
│   ├── supabase/
│   │   └── schema.sql # Run once in Supabase SQL editor
│   └── main.py
└── docs/
    └── README.md
```

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
- Supabase client helpers: `frontend/src/lib/supabase/client.ts` (browser) and `server.ts` (RSC/server actions)
- Canvas access tokens are Fernet-encrypted at rest (`app/core/encryption.py`)
- Environment: backend uses `.env`, frontend uses `.env.local`
