const { CORS_HEADERS, verifyPin } = require("./_shared");
const { getSupabase } = require("./_supabase");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  const supabase = getSupabase();

  try {
    const { slug, pin, class: className } = event.queryStringParameters || {};
    const school = await verifyPin(supabase, slug, pin);
    if (!className || className === "all") {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "A class is required" }) };
    }

    const { data: students, error: sErr } = await supabase
      .from("students")
      .select("id, name, roll_no")
      .eq("school_id", school.id)
      .eq("class", className)
      .eq("active", true)
      .order("roll_no");
    if (sErr) throw sErr;
    if (!students?.length) {
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ students: [] }) };
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
    const today = now.toISOString().slice(0, 10);

    const { data: attendance, error: aErr } = await supabase
      .from("attendance")
      .select("student_id, status, date")
      .eq("school_id", school.id)
      .eq("class", className)
      .gte("date", yearStart)
      .lte("date", today);
    if (aErr) throw aErr;

    const byStudent = {};
    students.forEach((s) => {
      byStudent[s.id] = { month: { present: 0, total: 0 }, year: { present: 0, total: 0 } };
    });
    (attendance || []).forEach((a) => {
      const bucket = byStudent[a.student_id];
      if (!bucket) return;
      bucket.year.total += 1;
      if (a.status === "present") bucket.year.present += 1;
      if (a.date >= monthStart) {
        bucket.month.total += 1;
        if (a.status === "present") bucket.month.present += 1;
      }
    });

    const result = students.map((s) => {
      const b = byStudent[s.id];
      const monthPct = b.month.total ? Math.round((b.month.present / b.month.total) * 100) : null;
      const yearPct = b.year.total ? Math.round((b.year.present / b.year.total) * 100) : null;
      return { id: s.id, name: s.name, roll_no: s.roll_no, monthPct, yearPct, perfectThisMonth: monthPct === 100 };
    });

    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ students: result }) };
  } catch (err) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
