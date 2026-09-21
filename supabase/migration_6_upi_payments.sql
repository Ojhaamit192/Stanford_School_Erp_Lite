-- Run this in Supabase SQL Editor after migration_5. Safe to run more than once.

alter table schools add column if not exists upi_id text;
alter table schools add column if not exists upi_qr_url text;
alter table staff add column if not exists upi_id text;

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

-- Fill in Stanford Prep's UPI details for the "Scan to Pay" option.
update schools
set upi_id = 'varunjyoti1986@ybl', upi_qr_url = '/assets/upi-qr.png'
where slug = 'stanford-prep';
