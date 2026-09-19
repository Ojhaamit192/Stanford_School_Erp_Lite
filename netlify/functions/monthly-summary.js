// Netlify Scheduled Function — runs on the 1st of every month (see netlify.toml).
// Summarizes the month that just finished.
const { getSupabase } = require("./_supabase");
const { sendSms } = require("./_sms");

function previousMonthRange() {
  const now = new Date();
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthEnd = new Date(firstOfThisMonth - 1); // last day of previous month
  const lastMonthStart = new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1);
  const monthKey = lastMonthStart.toISOString().slice(0, 7); // YYYY-MM
  const from = lastMonthStart.toISOString().slice(0, 10);
  const to = lastMonthEnd.toISOString().slice(0, 10);
  const label = lastMonthStart.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  return { monthKey, from, to, label };
}

exports.handler = async () => {
  const supabase = getSupabase();
  const { monthKey, from, to, label } = previousMonthRange();

  const { data: schools, error: schoolErr } = await supabase.from("schools").select("*");
  if (schoolErr) {
    console.error("monthly-summary: could not load schools", schoolErr.message);
    return { statusCode: 500 };
  }

  for (const school of schools) {
    try {
      const { data: payments } = await supabase
        .from("fee_payments")
        .select("amount")
        .eq("school_id", school.id)
        .eq("month", monthKey);
      const collection = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0);

      const { data: attendance } = await supabase
        .from("attendance")
        .select("status")
        .eq("school_id", school.id)
        .gte("date", from)
        .lte("date", to);
      const total = attendance?.length || 0;
      const present = (attendance || []).filter((a) => a.status === "present").length;
      const attendancePct = total ? Math.round((present / total) * 100) : 0;

      const { data: homework } = await supabase
        .from("homework")
        .select("id")
        .eq("school_id", school.id)
        .gte("date", from)
        .lte("date", to);
      const homeworkCount = homework?.length || 0;

      if (school.phone) {
        const msg = `${school.name} - ${label} Summary: Fees collection Rs.${collection}, Attendance average ${attendancePct}%, Homework bheja gaya ${homeworkCount} baar.`;
        await sendSms(school.phone, msg, { supabase, schoolId: school.id });
      }
    } catch (err) {
      console.error(`monthly-summary failed for school ${school.slug}:`, err.message);
    }
  }

  return { statusCode: 200 };
};
