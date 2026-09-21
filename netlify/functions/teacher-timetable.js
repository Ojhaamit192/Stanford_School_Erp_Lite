const { CORS_HEADERS, verifyStaffLogin } = require("./_shared");
const { getSupabase } = require("./_supabase");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  }
  const supabase = getSupabase();

  try {
    const { slug, phone, pin, class: className } = event.queryStringParameters || {};
    const { school, allowedClasses } = await verifyStaffLogin(supabase, slug, phone, pin);
    if (!allowedClasses.includes(className)) throw new Error("You are not assigned to this class");

    const { data, error } = await supabase
      .from("timetable_slots")
      .select("*")
      .eq("school_id", school.id)
      .eq("class", className)
      .order("period_no");
    if (error) throw error;
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ slots: data }) };
  } catch (err) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
