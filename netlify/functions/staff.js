const { CORS_HEADERS, verifyPin } = require("./_shared");
const { getSupabase } = require("./_supabase");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  const supabase = getSupabase();

  try {
    if (event.httpMethod === "GET") {
      const { slug, pin } = event.queryStringParameters || {};
      const school = await verifyPin(supabase, slug, pin);
      const { data, error } = await supabase
        .from("staff")
        .select("*")
        .eq("school_id", school.id)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ staff: data }) };
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const school = await verifyPin(supabase, body.slug, body.pin);

      if (body.action === "update") {
        const { id, name, role, phone, monthly_salary, joining_date, login_pin, assigned_classes, upi_id } = body;
        if (!id) return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Staff id is required" }) };
        const patch = {};
        if (name !== undefined) patch.name = name;
        if (role !== undefined) patch.role = role;
        if (phone !== undefined) patch.phone = phone || null;
        if (monthly_salary !== undefined) patch.monthly_salary = monthly_salary || 0;
        if (joining_date !== undefined) patch.joining_date = joining_date || null;
        if (login_pin !== undefined) patch.login_pin = login_pin || null;
        if (assigned_classes !== undefined) patch.assigned_classes = assigned_classes || null;
        if (upi_id !== undefined) patch.upi_id = upi_id || null;
        const { data, error } = await supabase.from("staff").update(patch).eq("id", id).eq("school_id", school.id).select().single();
        if (error) throw error;
        return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ staff: data }) };
      }

      const { name, role, phone, monthly_salary, joining_date, login_pin, assigned_classes, upi_id } = body;
      if (!name) return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Name is required" }) };
      const { data, error } = await supabase
        .from("staff")
        .insert({
          school_id: school.id,
          name,
          role: role || "Teacher",
          phone: phone || null,
          monthly_salary: monthly_salary || 0,
          joining_date: joining_date || null,
          login_pin: login_pin || null,
          assigned_classes: assigned_classes || null,
          upi_id: upi_id || null,
        })
        .select()
        .single();
      if (error) throw error;
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ staff: data }) };
    }

    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (err) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
