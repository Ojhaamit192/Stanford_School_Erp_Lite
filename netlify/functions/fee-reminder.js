// Netlify Scheduled Function — runs on the 5th and 15th of every month (see netlify.toml).
const { getSupabase } = require("./_supabase");
const { sendSms } = require("./_sms");

exports.handler = async () => {
  const supabase = getSupabase();
  const thisMonth = new Date().toISOString().slice(0, 7);

  const { data: schools, error: schoolErr } = await supabase.from("schools").select("*");
  if (schoolErr) {
    console.error("fee-reminder: could not load schools", schoolErr.message);
    return { statusCode: 500 };
  }

  for (const school of schools) {
    try {
      const { data: students, error: sErr } = await supabase
        .from("students")
        .select("id, name, parent_phone, monthly_fee")
        .eq("school_id", school.id)
        .eq("active", true)
        .gt("monthly_fee", 0);
      if (sErr) throw sErr;
      if (!students?.length) continue;

      const { data: payments, error: pErr } = await supabase
        .from("fee_payments")
        .select("student_id")
        .eq("school_id", school.id)
        .eq("month", thisMonth);
      if (pErr) throw pErr;

      const paidSet = new Set((payments || []).map((p) => p.student_id));
      const due = students.filter((s) => !paidSet.has(s.id));

      await Promise.all(
        due.map((s) =>
          sendSms(
            s.parent_phone,
            `${school.name}: ${s.name}'s fee for this month (₹${s.monthly_fee}) is still due. Please pay at the earliest.`,
            { supabase, schoolId: school.id }
          )
        )
      );
    } catch (err) {
      console.error(`fee-reminder failed for school ${school.slug}:`, err.message);
    }
  }

  return { statusCode: 200 };
};
