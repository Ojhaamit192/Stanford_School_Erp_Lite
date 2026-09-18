const { CORS_HEADERS, verifyPin } = require("./_shared");
const { getSupabase } = require("./_supabase");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  const supabase = getSupabase();

  try {
    if (event.httpMethod === "GET") {
      const { slug, pin, class: className } = event.queryStringParameters || {};
      const school = await verifyPin(supabase, slug, pin);
      let query = supabase.from("students").select("*").eq("school_id", school.id).eq("active", true).order("class").order("name");
      if (className && className !== "all") query = query.eq("class", className);
      const { data, error } = await query;
      if (error) throw error;
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ school, students: data }) };
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const school = await verifyPin(supabase, body.slug, body.pin);
      const { name, class: className, roll_no, father_name, mother_name, parent_phone, monthly_fee } = body;
      if (!name || !className || !parent_phone) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Name, class aur parent phone zaroori hai" }) };
      }
      const { data, error } = await supabase
        .from("students")
        .insert({
          school_id: school.id,
          name,
          class: className,
          roll_no: roll_no || null,
          father_name: father_name || null,
          mother_name: mother_name || null,
          parent_phone,
          monthly_fee: monthly_fee || 0,
        })
        .select()
        .single();
      if (error) throw error;
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ student: data }) };
    }

    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (err) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
