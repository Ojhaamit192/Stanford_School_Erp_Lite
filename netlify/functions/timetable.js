const { CORS_HEADERS, verifyPin } = require("./_shared");
const { getSupabase } = require("./_supabase");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  const supabase = getSupabase();

  try {
    if (event.httpMethod === "GET") {
      // ?slug&pin&class=Class 8  -> every slot for that class, all days
      const { slug, pin, class: className } = event.queryStringParameters || {};
      const school = await verifyPin(supabase, slug, pin);
      const { data, error } = await supabase
        .from("timetable_slots")
        .select("*")
        .eq("school_id", school.id)
        .eq("class", className)
        .order("period_no");
      if (error) throw error;
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ slots: data }) };
    }

    if (event.httpMethod === "POST") {
      // Replace-on-save: { slug, pin, class, day_of_week, periods: [{period_no, time_range, subject, teacher_name}] }
      const body = JSON.parse(event.body || "{}");
      const school = await verifyPin(supabase, body.slug, body.pin);
      const { class: className, day_of_week, periods } = body;
      if (!className || !day_of_week) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Class and day are required" }) };
      }

      const { error: delErr } = await supabase
        .from("timetable_slots")
        .delete()
        .eq("school_id", school.id)
        .eq("class", className)
        .eq("day_of_week", day_of_week);
      if (delErr) throw delErr;

      const rows = (periods || [])
        .filter((p) => p.subject)
        .map((p) => ({
          school_id: school.id,
          class: className,
          day_of_week,
          period_no: p.period_no,
          time_range: p.time_range || null,
          subject: p.subject,
          teacher_name: p.teacher_name || null,
        }));

      if (rows.length) {
        const { error: insErr } = await supabase.from("timetable_slots").insert(rows);
        if (insErr) throw insErr;
      }

      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ saved: rows.length }) };
    }

    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (err) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
