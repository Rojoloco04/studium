-- CourseWise Supabase Schema
-- Run this in the Supabase SQL editor: Dashboard → SQL → New query

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────
-- Canvas tokens (encrypted at app layer)
-- ─────────────────────────────────────────
create table if not exists canvas_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  domain text not null,
  encrypted_token text not null,
  canvas_user_id bigint,
  canvas_user_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─────────────────────────────────────────
-- Courses
-- ─────────────────────────────────────────
create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  canvas_id bigint not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  course_code text not null default '',
  term text,
  current_grade text,
  current_score numeric(5,2),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(canvas_id, user_id)
);

-- ─────────────────────────────────────────
-- Assignments
-- ─────────────────────────────────────────
create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  canvas_id bigint not null,
  course_id uuid references courses(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  due_at timestamptz,
  points_possible numeric(8,2),
  submission_types text[] default '{}',
  score numeric(8,2),
  submitted boolean default false,
  -- feedback loop fields (Week 5)
  estimated_hours numeric(4,2),
  actual_hours numeric(4,2),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(canvas_id, user_id)
);

-- ─────────────────────────────────────────
-- Syllabi (uploaded PDFs — Week 3)
-- ─────────────────────────────────────────
create table if not exists syllabi (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  course_id uuid references courses(id) on delete set null,
  file_name text not null,
  storage_path text not null,
  parsed_at timestamptz,
  parse_status text default 'pending', -- pending | done | failed
  raw_extraction jsonb,
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────
-- Study blocks (calendar sync — Week 4)
-- ─────────────────────────────────────────
create table if not exists study_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  assignment_id uuid references assignments(id) on delete cascade,
  course_id uuid references courses(id) on delete cascade,
  gcal_event_id text,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  duration_minutes int not null,
  status text default 'scheduled', -- scheduled | completed | skipped
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────
-- Updated_at triggers
-- ─────────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger canvas_tokens_updated_at before update on canvas_tokens
  for each row execute function update_updated_at();

create trigger courses_updated_at before update on courses
  for each row execute function update_updated_at();

create trigger assignments_updated_at before update on assignments
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────
alter table canvas_tokens enable row level security;
alter table courses enable row level security;
alter table assignments enable row level security;
alter table syllabi enable row level security;
alter table study_blocks enable row level security;

-- Users can only see their own data
create policy "own data" on canvas_tokens for all using (auth.uid() = user_id);
create policy "own data" on courses for all using (auth.uid() = user_id);
create policy "own data" on assignments for all using (auth.uid() = user_id);
create policy "own data" on syllabi for all using (auth.uid() = user_id);
create policy "own data" on study_blocks for all using (auth.uid() = user_id);

-- ─────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────
create index if not exists assignments_user_due on assignments(user_id, due_at);
create index if not exists assignments_course on assignments(course_id);
create index if not exists study_blocks_user on study_blocks(user_id, start_at);
