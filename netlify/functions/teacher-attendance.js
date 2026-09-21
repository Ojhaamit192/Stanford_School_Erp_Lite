const { CORS_HEADERS, verifyStaffLogin } = require("./_shared");
const { getSupabase, todayDate } = require("./_supabase");
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
      // { slug, phone, pin, class, date, records: [{student_id, status}] }
      const body = JSON.parse(event.body || "{}");
      const { school, allowedClasses } = await verifyStaffLogin(supabase, body.slug, body.phone, body.pin);
      if (!allowedClasses.includes(body.class)) throw new Error("You are not assigned to this class");

      const date = body.date || todayDate();
      const records = body.records || [];
      const rows = records.map((r) => ({ school_id: school.id, student_id: r.student_id, class: body.class, date, status: r.status }));

      const { error } = await supabase.from("attendance").upsert(rows, { onConflict: "student_id,date" });
      if (error) throw error;

      const { data: studentsInfo } = await supabase
        .from("students")
        .select("id, name, parent_phone")
        .in("id", records.map((r) => r.student_id));
      const phoneByStudent = Object.fromEntries((studentsInfo || []).map((s) => [s.id, s]));

      await Promise.all(
        records.map((r) => {
          const info = phoneByStudent[r.student_id];
          if (!info) return null;
          const msg =
            r.status === "present"
              ? `${school.name}: ${info.name} has arrived at school (${date}).`
              : `${school.name}: ${info.name} is absent from school today (${date}). Please inform the school if there is a reason.`;
          return sendSms(info.parent_phone, msg, { supabase, schoolId: school.id });
        })
      );

      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ saved: rows.length }) };
    }

    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (err) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
