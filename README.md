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
  `staff-salary.js`, `teacher-login.js`, `teacher-attendance.js`,
  `teacher-homework.js`, `teacher-results.js`, `teacher-timetable.js`,
  `teacher-messages.js`, `portal-login.js`, `portal-data.js`,
  `portal-messages.js`, `create-payment-order.js`, `verify-payment.js`,
  `fee-claim.js`, `payout-salary.js`.
  All follow `/api/*` (scheduled ones don't).
- `supabase/schema.sql` — tables: `schools`, `students`, `attendance`,
  `fee_payments`, `notices`, `exam_results`, `homework`, `enquiries`,
  `datesheets`, `sms_log`, `timetable_slots`, `tc_records`, `staff`,
  `staff_attendance`, `staff_salary_payments`, `messages`,
  `fee_payment_claims`, `result_publications`.
- `supabase/migration_2_trust_and_growth_features.sql` through
  `supabase/migration_7_marksheet_format.sql` — run these once, in order,
  if you deployed before those updates.
- `teacher.html` — Teacher Portal (see the panels table below).
- `portal.html` — Student/Parent Portal (see the panels table below).
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

## The four login panels

This update adds three new front-ends on top of the original Super Admin
panel, matching the role-based structure you asked for. All four share
the same Supabase backend and Tejvix look — they're separate pages, not
separate apps to deploy.

| Panel | File | Login | Who it's for |
|---|---|---|---|
| Super Admin | `admin.html` | School PIN | Principal/management — everything: fees, staff salary, admissions, reports, notices (unchanged from before, just relabelled) |
| Teacher | `teacher.html` | Phone number + a PIN you set per teacher | Daily attendance, marks entry, homework, timetable (read-only), replying to parent messages — scoped to that teacher's **assigned classes** only |
| Student/Parent | `portal.html` | Registered phone number + the student's roll number | Attendance %, homework, exam datesheet, report card downloads, online fee payment, messaging the school |
| Super Admin (multi-school) | `super-admin.html` | Master password | Combined view across every school (unchanged, see step 10) |

A student and their parent share one login and one view — in practice a
parent's dashboard *is* the child's dashboard, so this is one portal
rather than two, to avoid managing a second password per family for
data that's identical either way.

**Setting up a teacher's portal login:** in the Super Admin's Staff tab,
when adding or editing a staff member, fill in **Teacher Portal Login
PIN** and **Assigned Classes** (comma-separated, e.g. `Class 6, Class 7`).
Leave both blank for staff who don't need portal access (an accountant,
a peon). The Staff list shows "Portal ON" once a PIN is set.

**Setting up a parent's portal login:** nothing to set up — it already
works with the phone number and roll number already on the student's
record from the Students tab.

## Online fee payment (Razorpay)

`portal.html`'s "Pay Now Online" button needs a Razorpay account —
signup is free, and India's UPI/cards/netbanking all work through it.

1. Create an account at [razorpay.com](https://razorpay.com) and complete
   KYC (needed before you can accept live payments — test mode works
   immediately without it).
2. Dashboard → **Settings → API Keys** → generate a Key ID and Key Secret.
3. Add both as Netlify environment variables: `RAZORPAY_KEY_ID`,
   `RAZORPAY_KEY_SECRET`.

Until these are set, the Pay Now button shows "Online payment is not set
up yet — please pay by cash at the school for now" instead of failing
silently. Test mode lets you try the whole flow with Razorpay's test
card numbers before going live.

## UPI QR payment (works today, no Razorpay account needed)

Alongside the Razorpay button, the portal shows a **"Scan & Pay via
UPI"** card with a QR code and UPI ID you provide — the parent scans it
in any UPI app (GPay, PhonePe, etc.), pays directly to that account,
then taps "I've Paid" (optionally attaching a screenshot). This creates
a **pending claim**, not an automatic payment — a static QR has no way
to confirm a payment happened on its own, so the Super Admin checks
their bank/UPI app and confirms or rejects the claim from the Fees
tab's **Pending UPI Payment Claims** section. Confirming records the
payment and sends the parent a receipt, exactly like a cash payment
recorded manually.

**Setup:** in Supabase, set `schools.upi_id` (e.g. `name@bank`) and
`schools.upi_qr_url` (a QR code image — either upload one to Supabase
Storage and use its public URL, or add it as a static file under
`assets/` like `stanford-logo.png`) for the school. Stanford Prep's are
already set from the QR you shared — see migration_6 below.

**Worth knowing:** the account currently on file is a personal UPI ID,
not a school bank account — fine for testing collection end-to-end, but
worth swapping for the school's own account before real fees flow
through it.

## Staff salary payouts (RazorpayX — optional, advanced)

The Staff tab's Salary section can send a real UPI payout instead of
just recording a manual entry, via **RazorpayX** — a separate product
from the Razorpay Checkout used for fee collection, meant for sending
money out rather than collecting it.

This needs more setup than anything else in this project:

1. Apply for a RazorpayX current account at
   [razorpay.com/x](https://razorpay.com/x) — this goes through one of
   Razorpay's partner banks (RBL or ICICI) and needs full business KYC
   (registered business, PAN, address proof) — it is not the same
   signup as the regular Razorpay account above, and takes real
   verification time, not instant activation.
2. Once approved, fund the account (payouts are debited from this
   balance — RazorpayX does not extend credit).
3. Netlify env vars: `RAZORPAYX_KEY_ID`, `RAZORPAYX_KEY_SECRET` (the
   function falls back to `RAZORPAY_KEY_ID`/`SECRET` if a merchant has
   both products on one key set — check your RazorpayX dashboard),
   and `RAZORPAYX_ACCOUNT_NUMBER` (the RazorpayX virtual account number
   payouts are sent from).
4. Add each teacher's **UPI ID** in the Staff tab (new field) — without
   one, "Pay via UPI" doesn't show for that staff member and "Record"
   (manual entry) is the only option, exactly as before.

Until this is set up, the salary flow works exactly as it did before —
"Record" stays available for every staff member regardless.

## Messaging (parent ↔ teacher)

This is asynchronous — a message board per student, not a live chat with
typing indicators — which keeps it reliable on weak connections and
needs nothing beyond what's already in the stack. A parent posts from
`portal.html`; the assigned teacher sees and replies from `teacher.html`
under a "Messages" tab, one thread per student in their class.



True WhatsApp Business API messages need Meta's business approval and
pre-approved message templates — that takes days/weeks and has a per-message
cost. To get you **live today**, this uses the same **Fast2SMS** SMS route
as the salon app — no approval step, works on any Indian number instantly.
Every "parent update" in the app (attendance, fee receipt, reminder, notice,
result) goes out as SMS right now. Once you're ready, swapping `_sms.js` for
a WhatsApp Business API call is a contained change — the rest of the app
doesn't need to know which channel it went out on.

## Testing with mock data (before real students/staff are ready)

`supabase/seed_mock_data.sql` adds 8 fake students (across Nursery, LKG,
Class 6, 7, 8), 2 fake teachers with Teacher Portal logins, some
attendance/fee history, and 2 fake enquiries — all using obviously-fake
phone numbers (`999990XXXX`), so it can never collide with a real
parent or staff number.

**Before running it**, set `MOCK_MODE=true` in Netlify's environment
variables and redeploy. This forces every SMS the app would send —
attendance, fees, homework, everything — to be logged instead of
actually sent, even if a real Fast2SMS key is already configured. Every
one of those logged messages is visible in the Super Admin's **Message
Log** tab with a "mock" status pill, so you can see exactly what would
have gone out to which number.

Run `supabase/seed_mock_data.sql` once in the SQL Editor (safe to
re-run — it clears its own previous rows first). Test logins it creates,
each with its own distinct PIN so panels are never confused with each other:

| Panel | Login |
|---|---|
| Super Admin | PIN `1234` |
| Teacher — Sunita Devi (Class 6, 7) | Phone `9999900101`, PIN `1111` |
| Teacher — Rakesh Thakur (Class 8, Nursery, LKG) | Phone `9999900102`, PIN `2222` |
| Super Admin (multi-school) | `SUPER_ADMIN_PASSWORD` you set — see step 10 |

Student/Parent login is phone + roll number (no separate PIN, by design —
see "The four login panels" above for why one login covers both). All 8
mock students:

| Student | Class | Roll | Login (Phone / Roll) |
|---|---|---|---|
| Aarav Kumar | Class 6 | 1 | `9999900001` / `1` |
| Priya Singh | Class 6 | 2 | `9999900002` / `2` |
| Rohan Verma | Class 7 | 1 | `9999900003` / `1` |
| Ananya Gupta | Class 7 | 2 | `9999900004` / `2` |
| Karan Mehta | Class 8 | 1 | `9999900005` / `1` |
| Diya Sharma | Class 8 | 2 | `9999900006` / `2` |
| Aditya Yadav | Nursery | 1 | `9999900007` / `1` |
| Ishita Jha | LKG | 1 | `9999900008` / `1` |

Want the Super Admin PIN changed from the default `1234`? Run in the SQL
Editor:

```sql
update schools set admin_pin = '5678' where slug = 'stanford-prep';
```

(swap `5678` for whatever you'd rather use).

One mock student (Karan Mehta, roll 1, Class 8) is already marked absent
3 days running, so Bunk Alert has something to fire on the next run.

**Going live:** once real students and staff are added, run
`supabase/remove_mock_data.sql` to delete every mock row, and set
`MOCK_MODE=false` (or remove the variable) so real SMS goes out again.

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
| `RAZORPAY_KEY_ID` | optional — only for online fee payment, see below |
| `RAZORPAY_KEY_SECRET` | optional — only for online fee payment, see below |
| `RAZORPAYX_KEY_ID` | optional — only for staff salary UPI payouts, see below |
| `RAZORPAYX_KEY_SECRET` | optional — only for staff salary UPI payouts, see below |
| `RAZORPAYX_ACCOUNT_NUMBER` | optional — only for staff salary UPI payouts, see below |
| `MOCK_MODE` | set to `true` while testing with mock data (see below) — blocks all real SMS |
| `SUPER_ADMIN_PASSWORD` | for `super-admin.html`, see step 10 |

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
4. `supabase/migration_5_teacher_parent_portals.sql` — adds
   `staff.login_pin`, `staff.assigned_classes`, and the `messages` table.
5. `supabase/migration_6_upi_payments.sql` — adds `schools.upi_id`,
   `schools.upi_qr_url`, `staff.upi_id`, the `fee_payment_claims` table,
   and fills in Stanford Prep's UPI details.
6. `supabase/migration_7_marksheet_format.sql` — adds
   `exam_results.theory_max/theory_obtained/internal_max/internal_obtained`
   for the official marksheet layout (see below).
7. `supabase/migration_8_result_publishing.sql` — adds the
   `result_publications` table (see "Publishing results" below) and
   marks every exam already in `exam_results` as published, so nothing
   that was visible before this update disappears.

Or just run `supabase/run_everything.sql` instead of any of the above —
it does the same thing in one shot and is safe no matter what state
your database is currently in.

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

- **Four login panels** — Super Admin, Teacher, Student/Parent, and
  multi-school Super Admin — see "The four login panels" above for the
  full breakdown.
- **Father's Name / Mother's Name** — both fields now appear consistently
  wherever a student's name does: the Students tab, Excel export, and the
  Transfer Certificate.
- **One enquiry per phone per day** — the Admission Enquiry form (and its
  WhatsApp button) won't create a duplicate record or re-SMS the owner if
  the same number submits again on the same day.

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
- **Two attendance modes** — the Attendance tab (Super Admin and Teacher
  Portal) opens with a choice: **Live, in class** (date locked to today,
  for marking during the roll call) or **From paper register** (date
  editable, for updating the app at the end of the day off a physical
  sheet). Both save to the same place — this is about making the two
  real workflows explicit, not two different features underneath.
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

- **Report card matches the official marksheet** — mark entry now
  splits into Theory and Internal marks per subject (defaults 80/20,
  editable per exam), and the report card PDF (Report Card button in
  Results, and the "Download PDF" button on the parent's report-card
  link) is laid out like Stanford Prep's actual half-yearly marksheet:
  S.No/Subject/Theory/Internal/Total columns, a Grand Total row,
  Percentage, Grade (A+ down to C per the school's scale), Result
  (PASS/NEEDS IMPROVEMENT), and signature lines for Class Teacher,
  Principal, and Parent/Guardian. Older results entered before this
  update still display fine — they just show Theory/Internal as "-"
  and only the Total column, since they were entered as one combined
  score.

## Publishing results

Marks entry (Super Admin or Teacher Portal) only saves marks — it never
notifies parents or makes anything visible on its own anymore. Once every
subject for a class's exam has been entered (e.g. Class 8's copies are
all checked), the Super Admin publishes it from Results → **Publish
Result**: pick the class and exam, hit **Publish & Notify Parents**. That
one action:

- Makes the report card visible at that class's students' report-card
  links (and in the parent portal's Exams tab) — before publishing, the
  link shows "No results published yet" even if marks are already saved.
- Sends every parent in that class one SMS with their child's report
  card link, all at once, instead of a message per subject as marks
  trickle in.

**Unpublish** is there for mistakes — pulling a class+exam back to draft
if something needs correcting before parents see it. **Re-Publish** (the
button relabels itself once something is already published) re-sends
the notification SMS — useful if a mark gets corrected after the fact
and parents should know.

Teachers entering marks in the Teacher Portal never publish — that stays
a Super Admin action, matching how a Principal typically signs off on
results before they go out.

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
