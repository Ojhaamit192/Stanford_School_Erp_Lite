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
  `fees.js`, `notices.js`, `results.js`, `homework.js`. All follow `/api/*`.
- `supabase/schema.sql` — tables: `schools`, `students`, `attendance`,
  `fee_payments`, `notices`, `exam_results`, `homework`.
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

## Try it out

- Directory: `https://your-site.netlify.app/`
- Stanford Prep staff panel: `https://your-site.netlify.app/admin.html?school=stanford-prep` (PIN `1234`)

**Change this demo PIN in the `schools` table before showing it to the
real school.**

## Adding a new school (this is your "second, bigger project too" answer)

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
- **Homework** — teacher picks a class, types the homework (and/or pastes a
  photo link, same convention as the salon app's gallery photos), taps
  send. Every parent in that class gets an SMS with a short preview and a
  link to `homework.html` — opens straight in the phone's browser, shows
  the last 5 days for that class, no app and no WhatsApp media API needed.

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
