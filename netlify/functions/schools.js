const { CORS_HEADERS } = require("./_shared");
const { getSupabase } = require("./_supabase");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS_HEADERS, body: "" };

  const supabase = getSupabase();

  if (event.httpMethod === "GET") {
    const slug = event.queryStringParameters?.slug;
    let query = supabase.from("schools").select("*").order("created_at", { ascending: true });
    if (slug) query = query.eq("slug", slug);
    const { data, error } = await query;
    if (error) return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: error.message }) };
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(slug ? data[0] || null : data) };
  }

  return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
};
