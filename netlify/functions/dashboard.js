const { CORS_HEADERS, verifyPin } = require("./_shared");
const { getSupabase } = require("./_supabase");

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function monthsAgoKey(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 7);
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  const supabase = getSupabase();

  try {
    const { slug, pin } = event.queryStringParameters || {};
    const school = await verifyPin(supabase, slug, pin);

    // Attendance trend — last 14 days, % present per day.
    const from = isoDaysAgo(13);
    const { data: attendance, error: aErr } = await supabase
      .from("attendance")
      .select("date, status")
      .eq("school_id", school.id)
      .gte("date", from);
    if (aErr) throw aErr;

    const byDate = {};
    (attendance || []).forEach((a) => {
      byDate[a.date] = byDate[a.date] || { present: 0, total: 0 };
      byDate[a.date].total += 1;
      if (a.status === "present") byDate[a.date].present += 1;
    });
    const attendanceTrend = [];
    for (let i = 13; i >= 0; i--) {
      const date = isoDaysAgo(i);
      const d = byDate[date];
      attendanceTrend.push({ date, pct: d ? Math.round((d.present / d.total) * 100) : null });
    }

    // Fees trend — last 6 months, total collected.
    const { data: payments, error: pErr } = await supabase
      .from("fee_payments")
      .select("amount, month")
      .eq("school_id", school.id);
    if (pErr) throw pErr;

    const months = Array.from({ length: 6 }, (_, i) => monthsAgoKey(5 - i));
    const byMonth = Object.fromEntries(months.map((m) => [m, 0]));
    (payments || []).forEach((p) => {
      if (byMonth[p.month] !== undefined) byMonth[p.month] += Number(p.amount);
    });
    const feesTrend = months.map((m) => ({ month: m, total: byMonth[m] }));

    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ attendanceTrend, feesTrend }) };
  } catch (err) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
