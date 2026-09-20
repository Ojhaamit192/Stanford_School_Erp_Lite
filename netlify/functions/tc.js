const { CORS_HEADERS, verifyPin } = require("./_shared");
const { getSupabase } = require("./_supabase");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  const supabase = getSupabase();

  try {
    if (event.httpMethod === "GET") {
      // ?slug&pin -> issued TCs, newest first, with student details for the PDF/history list
      const { slug, pin } = event.queryStringParameters || {};
      const school = await verifyPin(supabase, slug, pin);
      const { data, error } = await supabase
        .from("tc_records")
        .select("*, students(name, roll_no, class, father_name, dob, parent_phone)")
        .eq("school_id", school.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ records: data }) };
    }

    if (event.httpMethod === "POST") {
      // { slug, pin, student_id, tc_number, date_of_leaving, reason, conduct, remarks }
      const body = JSON.parse(event.body || "{}");
      const school = await verifyPin(supabase, body.slug, body.pin);
      const { student_id, tc_number, date_of_leaving, reason, conduct, remarks } = body;
      if (!student_id || !tc_number) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Student and TC number are required" }) };
      }

      const { data: record, error: insErr } = await supabase
        .from("tc_records")
        .insert({
          school_id: school.id,
          student_id,
          tc_number,
          date_of_leaving: date_of_leaving || new Date().toISOString().slice(0, 10),
          reason: reason || null,
          conduct: conduct || "Good",
          remarks: remarks || null,
        })
        .select("*, students(name, roll_no, class, father_name, dob, parent_phone)")
        .single();
      if (insErr) throw insErr;

      // Issuing a TC means the student is leaving — take them off active rosters,
      // attendance/fees lists, etc. without deleting their history.
      const { error: updErr } = await supabase.from("students").update({ active: false }).eq("id", student_id).eq("school_id", school.id);
      if (updErr) throw updErr;

      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ record }) };
    }

    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (err) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
