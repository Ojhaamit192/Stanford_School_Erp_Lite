-- Run this in Supabase SQL Editor after migration_3. Safe to run more than once.

create table if not exists timetable_slots (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade,
  class text not null,
  day_of_week text not null,
  period_no integer not null,
  time_range text,
  subject text,
  teacher_name text,
  created_at timestamptz default now()
);

create table if not exists tc_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  tc_number text not null,
  date_of_leaving date not null default current_date,
  reason text,
  conduct text default 'Good',
  remarks text,
  created_at timestamptz default now()
);

create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade,
  name text not null,
  role text default 'Teacher',
  phone text,
  monthly_salary numeric default 0,
  joining_date date,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists staff_attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade,
  staff_id uuid references staff(id) on delete cascade,
  date date not null,
  status text not null check (status in ('present','absent')),
  created_at timestamptz default now(),
  unique (staff_id, date)
);

create table if not exists staff_salary_payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade,
  staff_id uuid references staff(id) on delete cascade,
  amount numeric not null,
  month text not null,
  paid_on date default current_date,
  method text default 'cash',
  created_at timestamptz default now()
);
