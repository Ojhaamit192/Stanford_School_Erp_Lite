-- Run this in Supabase SQL Editor after migration_4. Safe to run more than once.

alter table staff add column if not exists login_pin text;
alter table staff add column if not exists assigned_classes text;

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  sender text not null check (sender in ('parent','school')),
  sender_name text,
  text text not null,
  created_at timestamptz default now()
);
