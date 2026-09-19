const { CORS_HEADERS, verifyPin } = require("./_shared");
const { getSupabase } = require("./_supabase");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const supabase = getSupabase();

  try {
    const { slug, pin } = event.queryStringParameters || {};
    const school = await verifyPin(supabase, slug, pin);

    const { data, error } = await supabase
      .from("sms_log")
      .select("phone, message, status, created_at")
      .eq("school_id", school.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;

    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ log: data }) };
  } catch (err) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
