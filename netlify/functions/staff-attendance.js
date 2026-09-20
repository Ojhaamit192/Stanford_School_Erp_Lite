const { CORS_HEADERS, verifyPin } = require("./_shared");
const { getSupabase, todayDate } = require("./_supabase");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  const supabase = getSupabase();

  try {
    if (event.httpMethod === "GET") {
      // ?slug&pin&from&to -> attendance rows in range, for the register export
      const { slug, pin, from, to } = event.queryStringParameters || {};
      const school = await verifyPin(supabase, slug, pin);
      let query = supabase
        .from("staff_attendance")
        .select("*, staff(name, role)")
        .eq("school_id", school.id)
        .order("date", { ascending: true });
      if (from) query = query.gte("date", from);
      if (to) query = query.lte("date", to);
      const { data, error } = await query;
      if (error) throw error;
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ attendance: data }) };
    }

    if (event.httpMethod === "POST") {
      // { slug, pin, date, records: [{staff_id, status}] }
      const body = JSON.parse(event.body || "{}");
      const school = await verifyPin(supabase, body.slug, body.pin);
      const date = body.date || todayDate();
      const records = body.records || [];

      const rows = records.map((r) => ({ school_id: school.id, staff_id: r.staff_id, date, status: r.status }));
      const { error } = await supabase.from("staff_attendance").upsert(rows, { onConflict: "staff_id,date" });
      if (error) throw error;

      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ saved: rows.length }) };
    }

    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (err) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
