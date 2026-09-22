-- Run this in Supabase SQL Editor after migration_6. Safe to run more than once.

alter table exam_results add column if not exists theory_max numeric;
alter table exam_results add column if not exists theory_obtained numeric;
alter table exam_results add column if not exists internal_max numeric;
alter table exam_results add column if not exists internal_obtained numeric;
