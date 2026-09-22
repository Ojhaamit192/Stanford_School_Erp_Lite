-- RUN THIS ONE FILE — it replaces running schema.sql + every migration
-- file separately. It works no matter what state your database is
-- currently in (completely empty, partially set up, or already fully
-- migrated) and is 100% safe to run again if anything ever looks off.
--
-- Paste this whole file into a new Supabase SQL Editor query and hit Run.

-- ============ 1. CREATE EVERY TABLE (skipped if it already exists) ============

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
  month text not null,
  paid_on date default current_date,
  method text default 'cash',
  receipt_url text,
  created_at timestamptz default now()
);

create table if not exists notices (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade,
  class text default 'all',
  message text not null,
  created_at timestamptz default now()
);

create table if not exists exam_results (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  exam_name text not null,
  subject text not null,
  marks_obtained numeric not null,
  max_marks numeric not null default 100,
  theory_max numeric,
  theory_obtained numeric,
  internal_max numeric,
  internal_obtained numeric,
  created_at timestamptz default now()
);

create table if not exists result_publications (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade,
  class text not null,
  exam_name text not null,
  published_at timestamptz default now(),
  unique (school_id, class, exam_name)
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
  login_pin text,
  assigned_classes text,
  upi_id text,
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
  status text not null default 'sent',
  created_at timestamptz default now()
);

-- ============ 2. ADD ANY COLUMN A TABLE MIGHT BE MISSING ============
-- (covers the case where a table was created by an older/partial run)

alter table schools add column if not exists enquiry_phone text;
alter table schools add column if not exists map_link text;
alter table schools add column if not exists upi_id text;
alter table schools add column if not exists upi_qr_url text;
alter table schools add column if not exists logo_url text;

alter table students add column if not exists dob date;
alter table students add column if not exists photo_url text;
alter table students add column if not exists mother_name text;

alter table fee_payments add column if not exists receipt_url text;

alter table enquiries add column if not exists converted boolean default false;

alter table staff add column if not exists login_pin text;
alter table staff add column if not exists assigned_classes text;
alter table staff add column if not exists upi_id text;

alter table exam_results add column if not exists theory_max numeric;
alter table exam_results add column if not exists theory_obtained numeric;
alter table exam_results add column if not exists internal_max numeric;
alter table exam_results add column if not exists internal_obtained numeric;

-- ============ 3. SEED / UPDATE STANFORD PREP SCHOOL ============

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

update schools
set
  address = 'Patahi Chowk, Rewa Road, Muzaffarpur - 843113',
  phone = '+917352662955',
  enquiry_phone = '+917352662955, +919334160652',
  map_link = 'https://www.google.com/maps/place/26%C2%B006''52.2%22N+85%C2%B020''10.4%22E/@26.1145059,85.3336444,17z',
  logo_url = '/assets/stanford-logo.png',
  upi_id = 'varunjyoti1986@ybl',
  upi_qr_url = '/assets/upi-qr.png'
where slug = 'stanford-prep';

-- Any exam results already entered before the Publish feature existed are
-- treated as already published, so nothing that was visible before
-- suddenly disappears from a parent's report card.
insert into result_publications (school_id, class, exam_name)
select distinct er.school_id, s.class, er.exam_name
from exam_results er
join students s on s.id = er.student_id
on conflict (school_id, class, exam_name) do nothing;
