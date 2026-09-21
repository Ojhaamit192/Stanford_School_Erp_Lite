-- MOCK / DEMO DATA — for testing the app end-to-end before real students
-- and teachers are added. Everything here uses obviously-fake phone
-- numbers (999990XXXX) so nothing here can ever match a real parent or
-- staff phone number by accident.
--
-- IMPORTANT: set MOCK_MODE=true in your Netlify environment variables
-- before testing with this data — that stops any SMS (attendance,
-- fees, homework, etc.) from actually being sent to these fake numbers.
-- Every message that "would have gone out" is still saved and visible
-- in the Super Admin's Message Log tab, with a "mock" status pill.
--
-- Run this once in the Supabase SQL Editor. Safe to run again — it
-- clears out any previous mock rows first (matched by the 999990 phone
-- prefix) before re-inserting, so you won't get duplicates.
-- When you're ready to go live, run supabase/remove_mock_data.sql.

do $$
declare
  v_school_id uuid;
  v_student_1 uuid; v_student_2 uuid; v_student_3 uuid; v_student_4 uuid;
  v_student_5 uuid; v_student_6 uuid; v_student_7 uuid; v_student_8 uuid;
  v_teacher_1 uuid; v_teacher_2 uuid;
  v_today date := current_date;
begin
  select id into v_school_id from schools where slug = 'stanford-prep';
  if v_school_id is null then
    raise exception 'stanford-prep school not found — run schema.sql first';
  end if;

  -- Clear any previous mock rows so this script is safe to re-run.
  delete from students where school_id = v_school_id and parent_phone like '999990%';
  delete from staff where school_id = v_school_id and phone like '999990%';
  delete from enquiries where school_id = v_school_id and phone like '999990%';

  -- ---------- MOCK STUDENTS ----------
  insert into students (school_id, name, class, roll_no, father_name, mother_name, parent_phone, monthly_fee, dob)
  values (v_school_id, 'Aarav Kumar', 'Class 6', '1', 'Ramesh Kumar', 'Sunita Kumar', '9999900001', 500, '2015-04-12')
  returning id into v_student_1;

  insert into students (school_id, name, class, roll_no, father_name, mother_name, parent_phone, monthly_fee, dob)
  values (v_school_id, 'Priya Singh', 'Class 6', '2', 'Manoj Singh', 'Kavita Singh', '9999900002', 500, '2015-07-22')
  returning id into v_student_2;

  insert into students (school_id, name, class, roll_no, father_name, mother_name, parent_phone, monthly_fee, dob)
  values (v_school_id, 'Rohan Verma', 'Class 7', '1', 'Suresh Verma', 'Anita Verma', '9999900003', 600, '2014-02-15')
  returning id into v_student_3;

  insert into students (school_id, name, class, roll_no, father_name, mother_name, parent_phone, monthly_fee, dob)
  values (v_school_id, 'Ananya Gupta', 'Class 7', '2', 'Vikas Gupta', 'Neha Gupta', '9999900004', 600, '2014-09-30')
  returning id into v_student_4;

  insert into students (school_id, name, class, roll_no, father_name, mother_name, parent_phone, monthly_fee, dob)
  values (v_school_id, 'Karan Mehta', 'Class 8', '1', 'Ashok Mehta', 'Rekha Mehta', '9999900005', 700, '2013-01-10')
  returning id into v_student_5;

  insert into students (school_id, name, class, roll_no, father_name, mother_name, parent_phone, monthly_fee, dob)
  values (v_school_id, 'Diya Sharma', 'Class 8', '2', 'Rajesh Sharma', 'Pooja Sharma', '9999900006', 700, '2013-06-18')
  returning id into v_student_6;

  insert into students (school_id, name, class, roll_no, father_name, mother_name, parent_phone, monthly_fee, dob)
  values (v_school_id, 'Aditya Yadav', 'Nursery', '1', 'Sanjay Yadav', 'Meena Yadav', '9999900007', 400, '2019-03-05')
  returning id into v_student_7;

  insert into students (school_id, name, class, roll_no, father_name, mother_name, parent_phone, monthly_fee, dob)
  values (v_school_id, 'Ishita Jha', 'LKG', '1', 'Prakash Jha', 'Sarita Jha', '9999900008', 400, '2018-11-25')
  returning id into v_student_8;

  -- ---------- MOCK TEACHERS (with Teacher Portal login) ----------
  insert into staff (school_id, name, role, phone, monthly_salary, joining_date, login_pin, assigned_classes)
  values (v_school_id, 'Sunita Devi', 'Teacher', '9999900101', 15000, '2024-06-01', '1111', 'Class 6,Class 7')
  returning id into v_teacher_1;

  insert into staff (school_id, name, role, phone, monthly_salary, joining_date, login_pin, assigned_classes)
  values (v_school_id, 'Rakesh Thakur', 'Teacher', '9999900102', 15000, '2024-06-01', '2222', 'Class 8,Nursery,LKG')
  returning id into v_teacher_2;

  -- ---------- MOCK ATTENDANCE (last 5 weekdays, one student absent 3 days running) ----------
  insert into attendance (school_id, student_id, class, date, status) values
    (v_school_id, v_student_1, 'Class 6', v_today - 1, 'present'),
    (v_school_id, v_student_1, 'Class 6', v_today - 2, 'present'),
    (v_school_id, v_student_1, 'Class 6', v_today - 3, 'present'),
    (v_school_id, v_student_2, 'Class 6', v_today - 1, 'present'),
    (v_school_id, v_student_2, 'Class 6', v_today - 2, 'absent'),
    (v_school_id, v_student_2, 'Class 6', v_today - 3, 'present'),
    (v_school_id, v_student_3, 'Class 7', v_today - 1, 'present'),
    (v_school_id, v_student_3, 'Class 7', v_today - 2, 'present'),
    (v_school_id, v_student_3, 'Class 7', v_today - 3, 'present'),
    (v_school_id, v_student_4, 'Class 7', v_today - 1, 'present'),
    (v_school_id, v_student_4, 'Class 7', v_today - 2, 'present'),
    (v_school_id, v_student_4, 'Class 7', v_today - 3, 'absent'),
    -- Karan Mehta absent 3 days running — a ready-made example for Bunk Alert.
    (v_school_id, v_student_5, 'Class 8', v_today - 1, 'absent'),
    (v_school_id, v_student_5, 'Class 8', v_today - 2, 'absent'),
    (v_school_id, v_student_5, 'Class 8', v_today - 3, 'absent'),
    (v_school_id, v_student_6, 'Class 8', v_today - 1, 'present'),
    (v_school_id, v_student_6, 'Class 8', v_today - 2, 'present'),
    (v_school_id, v_student_6, 'Class 8', v_today - 3, 'present')
  on conflict (student_id, date) do nothing;

  -- ---------- MOCK FEE PAYMENTS (half the class already paid this month) ----------
  insert into fee_payments (school_id, student_id, amount, month, method) values
    (v_school_id, v_student_1, 500, to_char(v_today, 'YYYY-MM'), 'cash'),
    (v_school_id, v_student_3, 600, to_char(v_today, 'YYYY-MM'), 'cash'),
    (v_school_id, v_student_5, 700, to_char(v_today, 'YYYY-MM'), 'cash'),
    (v_school_id, v_student_7, 400, to_char(v_today, 'YYYY-MM'), 'cash');

  -- ---------- MOCK ADMISSION ENQUIRIES ----------
  insert into enquiries (school_id, name, phone, class_interested, converted) values
    (v_school_id, 'Test Parent One', '9999900201', 'Class 6', false),
    (v_school_id, 'Test Parent Two', '9999900202', 'UKG', true);

end $$;
