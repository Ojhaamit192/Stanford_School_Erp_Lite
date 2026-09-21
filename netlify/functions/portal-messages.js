const { CORS_HEADERS } = require("./_shared");
const { getSupabase } = require("./_supabase");

async function verifyStudent(supabase, slug, phone, roll_no) {
  const { data: school, error: schoolErr } = await supabase.from("schools").select("*").eq("slug", slug).single();
  if (schoolErr || !school) throw new Error("School not found");
  const { data: student, error: stuErr } = await supabase
    .from("students")
    .select("id, name, class")
    .eq("school_id", school.id)
    .eq("parent_phone", phone)
    .eq("roll_no", roll_no)
    .eq("active", true)
    .single();
  if (stuErr || !student) throw new Error("Student not found");
  return { school, student };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  const supabase = getSupabase();

  try {
    if (event.httpMethod === "GET") {
      const { slug, phone, roll_no } = event.queryStringParameters || {};
      const { student } = await verifyStudent(supabase, slug, phone, roll_no);
      const { data, error } = await supabase
        .from("messages")
        .select("sender, sender_name, text, created_at")
        .eq("student_id", student.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ messages: data }) };
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const { school, student } = await verifyStudent(supabase, body.slug, body.phone, body.roll_no);
      if (!body.text) return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Message text is required" }) };

      const { data, error } = await supabase
        .from("messages")
        .insert({ school_id: school.id, student_id: student.id, sender: "parent", sender_name: "Parent", text: body.text })
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
