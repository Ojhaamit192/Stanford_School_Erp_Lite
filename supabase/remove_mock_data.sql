-- Removes every mock row added by seed_mock_data.sql. Run this once you've
-- added real students and teachers and are ready to go live — attendance,
-- fees, and enquiries for these mock students are removed automatically
-- (foreign keys cascade) when the student/staff rows are deleted.

delete from students where parent_phone like '999990%';
delete from staff where phone like '999990%';
delete from enquiries where phone like '999990%';
