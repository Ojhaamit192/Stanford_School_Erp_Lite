const { CORS_HEADERS, verifyStaffLogin } = require("./_shared");
const { getSupabase } = require("./_supabase");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  }
  const supabase = getSupabase();

  try {
    const { slug, phone, pin } = JSON.parse(event.body || "{}");
    const { school, staff, allowedClasses } = await verifyStaffLogin(supabase, slug, phone, pin);
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        school: { name: school.name, logo_url: school.logo_url },
        staff: { id: staff.id, name: staff.name, role: staff.role },
        allowedClasses,
      }),
    };
  } catch (err) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
