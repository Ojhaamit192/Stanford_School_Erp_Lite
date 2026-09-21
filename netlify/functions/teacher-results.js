const { CORS_HEADERS, verifyStaffLogin } = require("./_shared");
const { getSupabase } = require("./_supabase");
const { sendSms } = require("./_sms");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  const supabase = getSupabase();

  try {
    if (event.httpMethod === "GET") {
      const { slug, phone, pin, class: className } = event.queryStringParameters || {};
      const { school, allowedClasses } = await verifyStaffLogin(supabase, slug, phone, pin);
      if (!allowedClasses.includes(className)) throw new Error("You are not assigned to this class");

      const { data: students, error } = await supabase
        .from("students")
        .select("id, name, roll_no")
        .eq("school_id", school.id)
        .eq("class", className)
        .eq("active", true)
        .order("roll_no");
      if (error) throw error;
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ students }) };
    }

    if (event.httpMethod === "POST") {
      // { slug, phone, pin, class, exam_name, subject, max_marks, entries: [{student_id, marks_obtained}], notify }
      const body = JSON.parse(event.body || "{}");
      const { school, allowedClasses } = await verifyStaffLogin(supabase, body.slug, body.phone, body.pin);
      if (!allowedClasses.includes(body.class)) throw new Error("You are not assigned to this class");
      const { exam_name, subject, entries, notify, max_marks } = body;
      if (!exam_name || !subject || !entries?.length) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "exam_name, subject and entries are required" }) };
      }

      const rows = entries.map((e) => ({
        school_id: school.id,
        student_id: e.student_id,
        exam_name,
        subject,
        marks_obtained: e.marks_obtained,
        max_marks: max_marks || 100,
      }));
      const { data, error } = await supabase.from("exam_results").insert(rows).select();
      if (error) throw error;

      if (notify) {
        const { data: students } = await supabase
          .from("students")
          .select("id, name, parent_phone")
          .in("id", entries.map((e) => e.student_id));
        const infoById = Object.fromEntries((students || []).map((s) => [s.id, s]));
        await Promise.all(
          entries.map((e) => {
            const info = infoById[e.student_id];
            if (!info) return null;
            const link = `${process.env.URL || ""}/report-card.html?school=${school.slug}&student=${e.student_id}`;
            const msg = `${school.name}: ${info.name} - ${exam_name} ${subject}: ${e.marks_obtained}/${max_marks || 100}. View report card: ${link}`;
            return sendSms(info.parent_phone, msg, { supabase, schoolId: school.id });
          })
        );
      }

      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ saved: data.length }) };
    }

    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (err) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
