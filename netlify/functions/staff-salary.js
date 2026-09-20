const { CORS_HEADERS, verifyPin } = require("./_shared");
const { getSupabase } = require("./_supabase");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  const supabase = getSupabase();

  try {
    if (event.httpMethod === "GET") {
      // ?slug&pin&month=2026-09 -> every active staff member with paid/due status for that month
      const { slug, pin, month } = event.queryStringParameters || {};
      const school = await verifyPin(supabase, slug, pin);
      const targetMonth = month || new Date().toISOString().slice(0, 7);

      const { data: staff, error: sErr } = await supabase
        .from("staff")
        .select("id, name, role, monthly_salary")
        .eq("school_id", school.id)
        .eq("active", true);
      if (sErr) throw sErr;

      const { data: payments, error: pErr } = await supabase
        .from("staff_salary_payments")
        .select("staff_id, amount")
        .eq("school_id", school.id)
        .eq("month", targetMonth);
      if (pErr) throw pErr;

      const paidSet = new Set((payments || []).map((p) => p.staff_id));
      const result = (staff || []).map((s) => ({ ...s, paid: paidSet.has(s.id) }));

      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ month: targetMonth, staff: result }) };
    }

    if (event.httpMethod === "POST") {
      // { slug, pin, staff_id, amount, month }
      const body = JSON.parse(event.body || "{}");
      const school = await verifyPin(supabase, body.slug, body.pin);
      const { staff_id, amount, month } = body;
      if (!staff_id || !amount) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "staff_id and amount are required" }) };
      }
      const targetMonth = month || new Date().toISOString().slice(0, 7);

      const { data: payment, error } = await supabase
        .from("staff_salary_payments")
        .insert({ school_id: school.id, staff_id, amount, month: targetMonth })
        .select()
        .single();
      if (error) throw error;

      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ payment }) };
    }

    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (err) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
