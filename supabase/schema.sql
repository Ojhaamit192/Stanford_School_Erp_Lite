-- School Lite ERP — multi-tenant schema
-- Run this once in Supabase SQL Editor.

create table if not exists schools (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  address text,
  phone text,
  admin_pin text not null default '1234',
  brand_color text default '#FF6A00',
  logo_url text,
  monthly_fee_note text,
  created_at timestamptz default now()
);

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade,
  name text not null,
  class text not null,
  roll_no text,
  father_name text,
  mother_name text,
  parent_phone text not null,
  monthly_fee numeric default 0,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  class text not null,
  date date not null,
  status text not null check (status in ('present','absent')),
  created_at timestamptz default now(),
  unique (student_id, date)
);

create table if not exists fee_payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  amount numeric not null,
  month text not null, -- e.g. '2026-09'
  paid_on date default current_date,
  method text default 'cash',
  created_at timestamptz default now()
);

create table if not exists notices (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade,
  class text default 'all', -- 'all' or a specific class name
  message text not null,
  created_at timestamptz default now()
);

create table if not exists exam_results (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  exam_name text not null, -- e.g. 'Monthly Test - Sept', 'Half Yearly', 'Annual'
  subject text not null,
  marks_obtained numeric not null,
  max_marks numeric not null default 100,
  created_at timestamptz default now()
);

create table if not exists homework (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade,
  class text not null,
  date date not null default current_date,
  text text,
  image_url text,
  created_at timestamptz default now()
);

-- Seed one demo school so the directory isn't empty on first deploy.
insert into schools (slug, name, address, phone, admin_pin, monthly_fee_note)
values ('stanford-prep', 'Stanford Prep School', 'Patahi Chowk, Muzaffarpur', '+91 7352662955', '1234', '₹500/month per student')
on conflict (slug) do nothing;
