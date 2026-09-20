-- Run this in Supabase SQL Editor after migration_2. Safe to run more than once.

alter table schools add column if not exists enquiry_phone text;
alter table schools add column if not exists map_link text;
alter table fee_payments add column if not exists receipt_url text;

-- Fill in Stanford Prep School's real details.
update schools
set
  address = 'Patahi Chowk, Rewa Road, Muzaffarpur - 843113',
  phone = '+917352662955',
  enquiry_phone = '+917352662955, +919334160652',
  map_link = 'https://www.google.com/maps/place/26%C2%B006''52.2%22N+85%C2%B020''10.4%22E/@26.1145059,85.3336444,17z',
  logo_url = '/assets/stanford-logo.png'
where slug = 'stanford-prep';
