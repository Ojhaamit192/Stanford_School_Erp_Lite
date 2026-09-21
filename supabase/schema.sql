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
  enquiry_phone text,
  map_link text,
  upi_id text,
  upi_qr_url text,
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
  dob date,
  photo_url text,
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
  receipt_url text,
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

create table if not exists enquiries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade,
  name text not null,
  phone text not null,
  class_interested text,
  converted boolean default false,
  created_at timestamptz default now()
);

create table if not exists timetable_slots (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade,
  class text not null,
  day_of_week text not null, -- 'Monday' .. 'Saturday'
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
  login_pin text,
  assigned_classes text,
  upi_id text, -- for RazorpayX salary payouts
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists fee_payment_claims (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  amount numeric not null,
  month text not null,
  screenshot_url text,
  status text not null default 'pending' check (status in ('pending','confirmed','rejected')),
  created_at timestamptz default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  sender text not null check (sender in ('parent','school')),
  sender_name text,
  text text not null,
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
  status text not null default 'sent', -- 'sent' | 'failed' | 'mock'
  created_at timestamptz default now()
);

-- Seed one demo school so the directory isn't empty on first deploy.
insert into schools (slug, name, address, phone, admin_pin, monthly_fee_note, enquiry_phone, map_link, logo_url, upi_id, upi_qr_url)
values (
  'stanford-prep',
  'Stanford Prep School',
  'Patahi Chowk, Rewa Road, Muzaffarpur - 843113',
  '+917352662955',
  '1234',
  '₹500/month per student',
  '+917352662955, +919334160652',
  'https://www.google.com/maps/place/26%C2%B006''52.2%22N+85%C2%B020''10.4%22E/@26.1145059,85.3336444,17z',
  '/assets/stanford-logo.png',
  'varunjyoti1986@ybl',
  '/assets/upi-qr.png'
)
on conflict (slug) do nothing;
