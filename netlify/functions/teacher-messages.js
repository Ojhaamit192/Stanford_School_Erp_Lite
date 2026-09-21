const { CORS_HEADERS, verifyStaffLogin } = require("./_shared");
const { getSupabase } = require("./_supabase");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  const supabase = getSupabase();

  try {
    if (event.httpMethod === "GET") {
      // ?slug&phone&pin&class=Class 6 -> every student in that class with an unread-ish thread count
      const { slug, phone, pin, class: className } = event.queryStringParameters || {};
      const { school, allowedClasses } = await verifyStaffLogin(supabase, slug, phone, pin);
      if (!allowedClasses.includes(className)) throw new Error("You are not assigned to this class");

      const { data: students, error: sErr } = await supabase
        .from("students")
        .select("id, name, roll_no")
        .eq("school_id", school.id)
        .eq("class", className)
        .eq("active", true)
        .order("roll_no");
      if (sErr) throw sErr;

      const { data: messages, error: mErr } = await supabase
        .from("messages")
        .select("student_id, sender, text, created_at")
        .eq("school_id", school.id)
        .in("student_id", students.map((s) => s.id))
        .order("created_at", { ascending: true });
      if (mErr) throw mErr;

      const byStudent = {};
      (messages || []).forEach((m) => {
        byStudent[m.student_id] = byStudent[m.student_id] || [];
        byStudent[m.student_id].push(m);
      });

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ students: students.map((s) => ({ ...s, messages: byStudent[s.id] || [] })) }),
      };
    }

    if (event.httpMethod === "POST") {
      // { slug, phone, pin, student_id, class, text }
      const body = JSON.parse(event.body || "{}");
      const { school, allowedClasses, staff } = await verifyStaffLogin(supabase, body.slug, body.phone, body.pin);
      if (!allowedClasses.includes(body.class)) throw new Error("You are not assigned to this class");
      if (!body.text || !body.student_id) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "student_id and text are required" }) };
      }
      const { data, error } = await supabase
        .from("messages")
        .insert({ school_id: school.id, student_id: body.student_id, sender: "school", sender_name: staff.name, text: body.text })
        .select()
        .single();
      if (error) throw error;
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ message: data }) };
    }

    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (err) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
