# School Lite — Multi-School Attendance/Fees/Notice/Result Platform

Same theme/architecture as the Tejvix salon app — **Supabase** (database),
**Fast2SMS** (parent messages), deployed on **Netlify** (frontend +
serverless functions). One codebase serves unlimited schools, each with its
own PIN-protected staff panel.

One demo school is seeded: **Stanford Prep School, Patahi Chowk,
Muzaffarpur** (PIN: `1234`).

## What's in this project

- `index.html` — public directory listing every school (parents/staff pick
  their school and open its staff panel).
- `admin.html` — the **staff panel**, opened as `admin.html?school=<slug>`.
  PIN-protected. Tabs: Students, Attendance, Fees, Notices, Results.
- `netlify/functions/` — `schools.js`, `students.js`, `attendance.js`,
  `fees.js`, `notices.js`, `results.js`, `homework.js`, `upload.js`,
  `enquiry.js`, `dashboard.js`, `attendance-insights.js`, `datesheet.js`,
  `message-log.js`, `bunk-alert.js`, `monthly-summary.js`,
  `birthday-wish.js`, `fee-reminder.js`, `super-admin.js`,
  `timetable.js`, `tc.js`, `staff.js`, `staff-attendance.js`,
  `staff-salary.js`. All follow `/api/*` (scheduled ones don't).
- `supabase/schema.sql` — tables: `schools`, `students`, `attendance`,
  `fee_payments`, `notices`, `exam_results`, `homework`, `enquiries`,
  `datesheets`, `sms_log`, `timetable_slots`, `tc_records`, `staff`,
  `staff_attendance`, `staff_salary_payments`.
- `supabase/migration_2_trust_and_growth_features.sql`,
  `supabase/migration_3_branding_and_contact.sql`, and
  `supabase/migration_4_timetable_tc_staff.sql` — run these once, in
  order, if you deployed before those updates.
- `report-card.html` — public, no-login report card view, opened via the
  SMS link sent when results are published for a student
  (`report-card.html?school=<slug>&student=<id>`).
- `datesheet.html` — public, no-login exam-datesheet view (same pattern as
  `homework.html`).
- `super-admin.html` — combined all-schools view, password-protected (see
  step 10).
- `homework.html` — public, no-login, no-app page opened via the SMS link
  (`homework.html?school=<slug>&class=<class>`) so parents can see the
  class's homework text/photo without installing anything.

## A note on "WhatsApp"

True WhatsApp Business API messages need Meta's business approval and
pre-approved message templates — that takes days/weeks and has a per-message
cost. To get you **live today**, this uses the same **Fast2SMS** SMS route
as the salon app — no approval step, works on any Indian number instantly.
Every "parent update" in the app (attendance, fee receipt, reminder, notice,
result) goes out as SMS right now. Once you're ready, swapping `_sms.js` for
a WhatsApp Business API call is a contained change — the rest of the app
doesn't need to know which channel it went out on.

## 1. Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query** → paste all of `supabase/schema.sql` → Run.
   This creates all 6 tables and seeds Stanford Prep School.
3. **Settings → API** → copy `Project URL` (→ `SUPABASE_URL`) and the
   `service_role` key (→ `SUPABASE_SERVICE_ROLE_KEY`).

## 2. Set up Fast2SMS

Sign up at [fast2sms.com](https://www.fast2sms.com), go to **Dev API**, copy
your key → `FAST2SMS_API_KEY`.

## 3. Push to GitHub & deploy on Netlify

```bash
git init
git add .
git commit -m "School Lite ERP"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

On [app.netlify.com](https://app.netlify.com): **Add new site → Import an
existing project** → connect the repo. `netlify.toml` already sets the
build config.

## 4. Environment variables

Netlify → **Site settings → Environment variables**:

| Key | Value |
|---|---|
| `SUPABASE_URL` | from Supabase Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | the service_role key |
| `FAST2SMS_API_KEY` | from Fast2SMS Dev API page |

Redeploy after adding these. Without them, everything still runs — SMS
just logs as `[DEV MODE - SMS not sent]` and DB calls fail until Supabase
keys are set.

## 5. Set up Supabase Storage (for the photo upload button)

Supabase → **Storage** → **New bucket** → name it exactly `school-photos` →
toggle **Public bucket** on → Create. That's it — `upload.js` writes into
`school-photos/<school-slug>/...` and the returned public URL is what gets
saved as the homework photo link.

## 6. GitHub Actions nightly backup (optional but recommended)

Repo → **Settings → Secrets and variables → Actions** → add two secrets:

| Secret | Value |
|---|---|
| `SUPABASE_URL` | same as the Netlify env var |
| `SUPABASE_SERVICE_ROLE_KEY` | same as the Netlify env var |

`.github/workflows/backup.yml` runs every night (2 AM IST), exports every
table to CSV, and commits it under `backups/<date>/` in the repo — so even
if Supabase ever has an issue, the school's data isn't only in one place.
You can also trigger it manually anytime from the repo's **Actions** tab.

## 7. Netlify preview links (no setup needed)

Once the repo is connected to Netlify, this is already on by default:
every pull request gets its own preview URL (Netlify comments it on the
PR) without touching the live site. Push new feature branches instead of
committing straight to `main` to make use of this before a real school
sees a half-finished change.



- Directory: `https://your-site.netlify.app/`
- Stanford Prep staff panel: `https://your-site.netlify.app/admin.html?school=stanford-prep` (PIN `1234`)

**Change this demo PIN in the `schools` table before showing it to the
real school.**

## 8. Scheduled functions (Bunk Alert, Monthly Summary, Birthday Wish, Fee Reminder)

These are wired up already in `netlify.toml` and need no extra dashboard
setup — Netlify reads the `schedule` config from `netlify.toml` and runs
`bunk-alert.js`, `birthday-wish.js`, and `fee-reminder.js` on their own
schedules, and `monthly-summary.js` monthly, once deployed. Two things to
keep in mind:

- Bunk Alert and Monthly Summary SMS the number in the school's `phone`
  column (the owner), not parents — make sure every school row has a real
  phone number. Birthday Wish and Fee Reminder SMS the parent directly.
- Scheduled Functions execute on their own — they don't appear in
  `/api/*` and don't need a PIN, since nothing calls them from the browser.
  You can see their run history under Netlify → your site → **Logs → Functions**.

## 9. If you already ran schema.sql before this update

Run these files, in order, in the Supabase SQL Editor (all additive and
safe to run more than once):

1. `supabase/migration_2_trust_and_growth_features.sql` — adds
   `students.dob`, `students.photo_url`, `enquiries.converted`,
   `datesheets`, `sms_log`.
2. `supabase/migration_3_branding_and_contact.sql` — adds
   `schools.enquiry_phone`, `schools.map_link`,
   `fee_payments.receipt_url`, and fills in Stanford Prep School's real
   address, phone numbers, map link, and logo.
3. `supabase/migration_4_timetable_tc_staff.sql` — adds `timetable_slots`,
   `tc_records`, `staff`, `staff_attendance`, `staff_salary_payments`.

## 10. Super Admin (only if you run more than one school yourself)

`super-admin.html` shows every school's students, this month's collection,
30-day attendance %, and enquiry→admission conversion in one combined
view. It's protected by a single master password, not a per-school PIN —
set `SUPER_ADMIN_PASSWORD` in Netlify's environment variables (any string
you choose) and open `your-site.netlify.app/super-admin.html`. Don't share
this URL/password with school owners — it's for you.

## Adding a new school

Run in Supabase SQL Editor:

```sql
insert into schools (slug, name, address, phone, admin_pin)
values ('new-school-slug', 'New School Name', 'Address, City', '+91 xxxxxxxxxx', '9999');
```

It shows up in the directory immediately — no code changes. This is also
how you'd offer a **cheaper "Lite" tier** (the 5 modules here) vs a future
**"Pro" tier** (add Staff/HR, Transport, multi-branch dashboard as extra
tables + functions) — same codebase, different feature flags per school
row if you want to gate features later.

## What's built right now (matches what you pitched on WhatsApp)

- **Attendance** — teacher marks Present/Absent per class per day; parent
  gets an SMS immediately; a monthly register (CSV, opens fine in Excel,
  student rows × date columns like a traditional attendance register) is
  downloadable per class.
- **Fees** — cash entry → instant SMS receipt; due list per month; one-tap
  reminder SMS to anyone who hasn't paid.
- **Notices / Holiday messages** — broadcast to the whole school or one
  class, logged in a history list.
- **Exam Results** — enter marks subject-by-subject for Monthly Test / Half
  Yearly / Annual exams; optional SMS to parents with the student's total.
- **Homework** — teacher picks a class, types the homework (and/or uploads
  a photo straight from phone camera/gallery — goes to Supabase Storage,
  no more pasting external links), taps send. Every parent in that class
  gets an SMS with a short preview and a link to `homework.html` — opens
  straight in the phone's browser, shows the last 5 days for that class,
  no app and no WhatsApp media API needed.
- **Report Card (PDF)** — pick a class and student in the Results tab,
  download a PDF with every exam's subject-wise marks and totals, branded
  with the school's name. Generated client-side with jsPDF (loaded from a
  CDN — fine here since this is your own deployed site, not a sandboxed
  preview).
- **Bunk Alert** (automatic, no button) — every day, if a student's last 3
  marked attendance entries are all `absent`, the school owner (not the
  parent) gets one SMS naming every such student. Runs as a Netlify
  Scheduled Function (`bunk-alert.js`, configured in `netlify.toml`).
- **Monthly Summary to Owner** (automatic) — on the 1st of every month, the
  owner gets one SMS: total fee collection, average attendance %, and how
  many homework entries went out, for the month that just finished.
  (`monthly-summary.js`, also scheduled in `netlify.toml`.)
- **Class Rank on Report Card** — the PDF now also shows "Class Rank: X / Y"
  under each exam's total, computed from the same class's stored results
  — no extra data entry needed.
- **Owner Dashboard** — first tab after login now shows two charts: a
  14-day attendance % trend and a 6-month fees collection trend
  (Chart.js, loaded from CDN), plus an Admission Enquiries list with a
  "Mark Converted" button and a live enquiry→admission conversion count.
- **Birthday Wish** (automatic) — every day, any student whose date of
  birth matches today gets a birthday SMS sent to their parent.
- **Exam Datesheet Broadcast** — a dedicated message type, separate from
  general Notices: pick a class, exam name, and a day-by-day datesheet
  (free text, one line per day), send — parents get an SMS with a preview
  and a link to `datesheet.html` for the full schedule.
- **ID Card (PDF)** — in the Students tab, pick a class and student,
  download a credit-card-sized ID with the school name, student's photo
  (if uploaded), class, roll number, and parent's phone.
- **Message Log** — every SMS the app sends (attendance, fees, notices,
  homework, datesheets, alerts) is logged with phone number, message text,
  and delivery status, visible in its own tab — useful when a parent says
  "I didn't get the message" and you need to check what actually went out.
- **Admission Enquiry Form** — on the public directory (`index.html`), each
  school card has an "Admission Enquiry" button that opens a small form
  (name, phone, class interested). Submitting it saves the enquiry and
  SMSes the owner immediately — a walk-in/organic-traffic conversion tool,
  no login needed to use it.
- **Super Admin** — see step 10 above; a combined, all-schools view for
  when you're running this as a product across multiple clients.
- **Classes** — Nursery, LKG, UKG, and Class 1–10, as a fixed dropdown
  everywhere a class is picked (no free-typing, so "Class 8" never gets
  entered three different ways).
- **Editable students, with photo** — every student row in the Students
  tab has an Edit button, so a phone number, DOB, or photo can be added or
  fixed after the student was first added — useful since real photos and
  details often arrive later, in batches, from a phone gallery.
- **Bulk Excel import** — upload a spreadsheet (name, class, roll_no,
  father_name, parent_phone, monthly_fee, dob columns) and every valid row
  becomes a student in one go — the practical alternative to reading
  names off a photographed register, which no OCR does reliably enough to
  trust for admissions data.
- **Excel + PDF export everywhere it matters** — the student list and the
  fees status list can both be downloaded as a real `.xlsx` (via
  SheetJS) or a PDF, per class, alongside the existing attendance
  register export and report card / ID card PDFs.
- **Mark All Present / Mark All Absent** — one click in the Attendance
  tab sets the whole loaded class before you flip the few exceptions,
  instead of tapping every student individually.
- **Fees — manual amount + optional receipt photo** — recording a payment
  is no longer a fixed one-click "mark paid": the amount is editable
  (partial payments included) and a receipt photo can be attached from
  the phone gallery, stored alongside that payment.
- **Automatic Fee Reminder** — on the 5th and 15th of every month, anyone
  who hasn't paid that month's fee gets an SMS automatically, no button
  needed.
- **Attendance by Class & Student (Dashboard)** — pick a class and see
  every student's attendance % for this month and this year side by
  side, roll-number ordered, with a 🏆 next to anyone at 100% this month.
- **WhatsApp enquiry option** — next to the existing enquiry form on the
  public directory, a small green WhatsApp button: it saves the enquiry
  the same way the form does (so it always shows up on the Dashboard),
  then opens WhatsApp with the details prefilled so the parent can also
  message the school directly if they prefer.
- **Report card, sent as a link** — when results are published with
  "notify" checked, the SMS now includes a link to that student's
  report card (`report-card.html`) — school logo, address, map link and
  phone shown at the top, so it reads as an official document, not just
  a text message.
- **Per-school branding** — `schools.logo_url`, `schools.map_link`, and
  `schools.enquiry_phone` let each school show its own logo and contact
  details on its directory card and report cards, independent of the
  Tejvix platform branding in the header.
- **Timetable** — a Timetable tab: pick a class and day, fill in periods
  (time, subject, teacher), save — saving replaces that day's periods for
  that class. A "Full Week" PDF pulls together every saved day for the
  selected class.
- **Transfer Certificate** — in the Students tab: pick a student, fill in
  TC number, date of leaving, reason, and conduct, and it generates a
  formatted TC PDF (school name, address, all the standard fields) and
  automatically moves that student to inactive (removed from active
  rosters, attendance, and fees lists) without deleting their history.
- **Staff / Teacher management** — a new Staff tab, parallel to the
  Student/Attendance/Fees pattern: add staff with role and monthly
  salary, mark daily staff attendance (with Mark All Present/Absent,
  same as students), and record monthly salary payments against a
  paid/due list per staff member. No SMS is sent for staff — this is an
  internal record only.
- **Tejvix branding** — the logo and "by TEJVIX · tejvix.com" line are on
  every page header now (`assets/tejvix-logo.png`), same dark/gold glow
  theme as the salon app.

## UI/UX refinement pass

Same features, same data model — this pass only touched layout, spacing,
and consistency, per your "refinement not redesign" brief:

- A `--warning` color token and a proper 3-tier panel hierarchy
  (`--bg` → `--bg-panel` → `--bg-panel-2`) alongside the existing
  dark/gold Tejvix palette.
- A stat-card row at the top of the Dashboard (Total Students, Avg
  Attendance, This Month's Collection, Enquiry → Admission) so the most
  important numbers are visible before scrolling — no more digging
  through cards to find "how are we doing right now."
- Every list now has a real empty state ("No students yet — add one
  below or bulk-import from Excel") instead of a blank table.
- Every table wide enough to overflow on a phone now scrolls inside its
  own container instead of squeezing the whole page sideways.
- Subtle hover/press transitions on buttons, tabs, and toggles — a
  refinement in the literal sense, meant to be felt more than noticed.

## Limitations to know about (demo-grade, same honesty as the salon app)

- PIN login is simple, single shared PIN per school — fine for one owner/a
  couple of teachers sharing a device, not per-teacher accounts yet.
- Results entry is one subject at a time per save (enter Maths marks for
  the whole class, save, switch to Science, save again) — quick enough for
  a small school, but not a bulk-upload sheet yet.
- No parent-facing login — by design ("Zero App" model), everything reaches
  them via SMS. If a parent wants to see history, that's a good next
  feature (a read-only link, still no install needed).
- Attendance register export is CSV (opens perfectly in Excel/Google
  Sheets) rather than a native `.xlsx` file — if you specifically need a
  styled `.xlsx`, that's a small addition (a JS library, no backend change).
