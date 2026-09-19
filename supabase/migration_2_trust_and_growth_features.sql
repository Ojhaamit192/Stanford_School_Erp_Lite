-- Run this in Supabase SQL Editor if you already ran schema.sql before
-- (i.e. the Stanford Prep deploy). Safe to run more than once.

alter table students add column if not exists dob date;
alter table students add column if not exists photo_url text;

alter table enquiries add column if not exists converted boolean default false;

create table if not exists datesheets (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade,
  class text not null,
  exam_name text not null,
  text text not null,
  created_at timestamptz default now()
);

create table if not exists sms_log (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade,
  phone text not null,
  message text not null,
  status text not null default 'sent',
  created_at timestamptz default now()
);
