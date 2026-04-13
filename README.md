# CourseWise

AI-powered course tracker and study planner. Syncs with Canvas, parses syllabi with Gemini, and schedules study blocks into Google Calendar.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| Backend | FastAPI + Python 3.12 |
| Database | Supabase (Postgres) |
| Auth | Supabase Auth (email + Google OAuth) |
| AI | Gemini 2.5 Flash / Pro (GCP credits) |
| Frontend deploy | Vercel |
| Backend deploy | Railway |
| PWA | next-pwa |

## Project Structure

```
coursewise/
├── frontend/          # Next.js app → Vercel
│   ├── src/
│   │   ├── app/       # App Router pages
│   │   ├── components/
│   │   └── lib/       # Supabase clients, utilities
│   └── public/        # PWA manifest, icons
└── backend/           # FastAPI → Railway
    ├── app/
    │   ├── api/       # Route handlers
    │   ├── core/      # Config, auth, supabase, encryption
    │   ├── models/    # Pydantic schemas
    │   └── services/  # Canvas, Gemini, Calendar logic
    ├── supabase/
    │   └── schema.sql # Run once in Supabase SQL editor
    └── main.py
```

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run `backend/supabase/schema.sql` in the SQL editor
3. Enable Google OAuth under Authentication → Providers
4. Add your site URL and redirect URLs under Authentication → URL Configuration

### 2. Backend (local)

```bash
cd backend
python -m venv venv && source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Fill in .env with your keys
# Generate encryption key:
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
uvicorn main:app --reload
```

Backend runs at http://localhost:8000. API docs at http://localhost:8000/docs.

### 3. Frontend (local)

```bash
cd frontend
npm install
cp .env.local.example .env.local
# Fill in Supabase URL, anon key, and backend URL
npm run dev
```

Frontend runs at http://localhost:3000.

### 4. Canvas

1. Log into your Canvas instance
2. Go to Account → Settings → Approved Integrations → + New Access Token
3. Name it "CourseWise", generate, copy the token
4. In the app: Dashboard → Canvas Setup → paste your domain + token

---

## Deployment

### Backend → Railway

1. Push `backend/` to a GitHub repo (or the monorepo root)
2. Create a new Railway project → Deploy from GitHub
3. Set environment variables in Railway dashboard (same as `.env`)
4. Railway auto-detects `railway.toml` and builds the Dockerfile

### Frontend → Vercel

1. Import the repo in Vercel, set root to `frontend/`
2. Set environment variables (Supabase URL, anon key, Railway backend URL)
3. Deploy

---

## Build Roadmap

| Week | Feature |
|---|---|
| 1 | ✅ Scaffold, auth, deployed skeleton |
| 2 | Canvas integration — real courses + assignments |
| 3 | Syllabus PDF parser (Gemini) |
| 4 | Smart study scheduler → Google Calendar |
| 5 | Grade estimator + feedback loop |
| 6+ | Professor insights, study buddy chat, mobile polish |

---

## Generating the Fernet encryption key

```python
from cryptography.fernet import Fernet
print(Fernet.generate_key().decode())
```

Paste the output into `CANVAS_TOKEN_ENCRYPTION_KEY` in your `.env`.
