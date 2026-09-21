const { CORS_HEADERS } = require("./_shared");
const { getSupabase } = require("./_supabase");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  }
  const supabase = getSupabase();

  try {
    // Login is the registered parent phone + the student's roll number — no separate
    // password to create/reset for every family. Both must match the same student row.
    const { slug, phone, roll_no } = JSON.parse(event.body || "{}");
    if (!slug || !phone || !roll_no) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Phone and roll number are required" }) };
    }

    const { data: school, error: schoolErr } = await supabase.from("schools").select("*").eq("slug", slug).single();
    if (schoolErr || !school) throw new Error("School not found");

    const { data: student, error: stuErr } = await supabase
      .from("students")
      .select("*")
      .eq("school_id", school.id)
      .eq("parent_phone", phone)
      .eq("roll_no", roll_no)
      .eq("active", true)
      .single();
    if (stuErr || !student) throw new Error("No matching student found — check the phone number and roll number");

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        school: { name: school.name, logo_url: school.logo_url, slug: school.slug },
        student,
      }),
    };
  } catch (err) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
