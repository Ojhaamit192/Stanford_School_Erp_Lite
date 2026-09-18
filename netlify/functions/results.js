const { CORS_HEADERS, verifyPin } = require("./_shared");
const { getSupabase } = require("./_supabase");
const { sendSms } = require("./_sms");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  const supabase = getSupabase();

  try {
    if (event.httpMethod === "GET") {
      // ?slug&pin&class=Class 8&exam_name=Half Yearly  -> all results for that exam+class, grouped client-side
      const { slug, pin, class: className, exam_name } = event.queryStringParameters || {};
      const school = await verifyPin(supabase, slug, pin);
      let query = supabase
        .from("exam_results")
        .select("*, students(name, roll_no, class, parent_phone)")
        .eq("school_id", school.id)
        .order("created_at", { ascending: false });
      if (exam_name) query = query.eq("exam_name", exam_name);
      const { data, error } = await query;
      if (error) throw error;
      const filtered = className && className !== "all" ? data.filter((r) => r.students?.class === className) : data;
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ results: filtered }) };
    }

    if (event.httpMethod === "POST") {
      // { slug, pin, exam_name, entries: [{student_id, subject, marks_obtained, max_marks}], notify: true }
      const body = JSON.parse(event.body || "{}");
      const school = await verifyPin(supabase, body.slug, body.pin);
      const { exam_name, entries, notify } = body;
      if (!exam_name || !entries?.length) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "exam_name aur entries zaroori hai" }) };
      }

      const rows = entries.map((e) => ({
        school_id: school.id,
        student_id: e.student_id,
        exam_name,
        subject: e.subject,
        marks_obtained: e.marks_obtained,
        max_marks: e.max_marks || 100,
      }));
      const { data, error } = await supabase.from("exam_results").insert(rows).select();
      if (error) throw error;

      if (notify) {
        // Group by student, send one summary message per student.
        const byStudent = {};
        for (const e of entries) {
          byStudent[e.student_id] = byStudent[e.student_id] || [];
          byStudent[e.student_id].push(e);
        }
        const studentIds = Object.keys(byStudent);
        const { data: students } = await supabase.from("students").select("id, name, parent_phone").in("id", studentIds);
        const infoById = Object.fromEntries((students || []).map((s) => [s.id, s]));

        await Promise.all(
          studentIds.map((sid) => {
            const info = infoById[sid];
            if (!info) return null;
            const total = byStudent[sid].reduce((sum, e) => sum + Number(e.marks_obtained), 0);
            const maxTotal = byStudent[sid].reduce((sum, e) => sum + Number(e.max_marks || 100), 0);
            const msg = `${school.name}: ${info.name} - ${exam_name} result: ${total}/${maxTotal}.`;
            return sendSms(info.parent_phone, msg);
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
