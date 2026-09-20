const { CORS_HEADERS, verifyPin } = require("./_shared");
const { getSupabase, todayDate } = require("./_supabase");
const { sendSms } = require("./_sms");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  const supabase = getSupabase();

  try {
    if (event.httpMethod === "GET") {
      // Fetch attendance for a school, optionally by class, optionally by date range (for the CSV/Excel export).
      const { slug, pin, class: className, from, to } = event.queryStringParameters || {};
      const school = await verifyPin(supabase, slug, pin);
      let query = supabase
        .from("attendance")
        .select("*, students(name, roll_no, class)")
        .eq("school_id", school.id)
        .order("date", { ascending: true });
      if (className && className !== "all") query = query.eq("class", className);
      if (from) query = query.gte("date", from);
      if (to) query = query.lte("date", to);
      const { data, error } = await query;
      if (error) throw error;
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ attendance: data }) };
    }

    if (event.httpMethod === "POST") {
      // body: { slug, pin, class, date, records: [{student_id, status}] }
      const body = JSON.parse(event.body || "{}");
      const school = await verifyPin(supabase, body.slug, body.pin);
      const date = body.date || todayDate();
      const records = body.records || [];

      const rows = records.map((r) => ({
        school_id: school.id,
        student_id: r.student_id,
        class: body.class,
        date,
        status: r.status,
      }));

      const { error } = await supabase
        .from("attendance")
        .upsert(rows, { onConflict: "student_id,date" });
      if (error) throw error;

      // Notify parents (fire-and-forget style, but we await so Netlify doesn't kill the function early)
      const { data: students } = await supabase
        .from("students")
        .select("id, name, parent_phone")
        .in("id", records.map((r) => r.student_id));

      const phoneByStudent = Object.fromEntries((students || []).map((s) => [s.id, { name: s.name, phone: s.parent_phone }]));

      await Promise.all(
        records.map((r) => {
          const info = phoneByStudent[r.student_id];
          if (!info) return null;
          const msg =
            r.status === "present"
              ? `${school.name}: ${info.name} has arrived at school (${date}).`
              : `${school.name}: ${info.name} is absent from school today (${date}). Please inform the school if there is a reason.`;
          return sendSms(info.phone, msg, { supabase, schoolId: school.id });
        })
      );

      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ saved: rows.length }) };
    }

    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (err) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
