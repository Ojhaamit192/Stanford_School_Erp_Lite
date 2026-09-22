const { CORS_HEADERS, verifyStaffLogin } = require("./_shared");
const { getSupabase } = require("./_supabase");

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
      // Marks entry only — the school office publishes results (and notifies parents)
      // from the Super Admin panel once every subject for a class is entered.
      // { slug, phone, pin, class, exam_name, subject, theory_max, internal_max, entries: [{student_id, theory_obtained, internal_obtained}] }
      const body = JSON.parse(event.body || "{}");
      const { school, allowedClasses } = await verifyStaffLogin(supabase, body.slug, body.phone, body.pin);
      if (!allowedClasses.includes(body.class)) throw new Error("You are not assigned to this class");
      const { exam_name, subject, entries, max_marks, theory_max, internal_max } = body;
      if (!exam_name || !subject || !entries?.length) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "exam_name, subject and entries are required" }) };
      }

      const hasSplit = theory_max !== undefined && internal_max !== undefined;
      const tMax = hasSplit ? Number(theory_max) || 0 : null;
      const iMax = hasSplit ? Number(internal_max) || 0 : null;
      const rows = entries.map((e) => {
        const tObt = hasSplit ? Number(e.theory_obtained) || 0 : null;
        const iObt = hasSplit ? Number(e.internal_obtained) || 0 : null;
        const marks_obtained = hasSplit ? tObt + iObt : Number(e.marks_obtained) || 0;
        const marksMax = hasSplit ? tMax + iMax : max_marks || 100;
        return {
          school_id: school.id,
          student_id: e.student_id,
          exam_name,
          subject,
          marks_obtained,
          max_marks: marksMax,
          theory_max: tMax,
          theory_obtained: tObt,
          internal_max: iMax,
          internal_obtained: iObt,
        };
      });
      const { data, error } = await supabase.from("exam_results").insert(rows).select();
      if (error) throw error;

      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ saved: data.length }) };
    }

    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (err) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
