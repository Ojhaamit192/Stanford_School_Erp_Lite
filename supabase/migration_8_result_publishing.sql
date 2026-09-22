-- Run this in Supabase SQL Editor after migration_7. Safe to run more than once.

create table if not exists result_publications (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade,
  class text not null,
  exam_name text not null,
  published_at timestamptz default now(),
  unique (school_id, class, exam_name)
);

-- Any exam results already entered before this feature existed are
-- treated as already published, so nothing that was visible before
-- suddenly disappears from a parent's report card.
insert into result_publications (school_id, class, exam_name)
select distinct er.school_id, s.class, er.exam_name
from exam_results er
join students s on s.id = er.student_id
on conflict (school_id, class, exam_name) do nothing;
