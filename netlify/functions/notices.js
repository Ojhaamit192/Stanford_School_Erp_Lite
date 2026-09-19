const { CORS_HEADERS, verifyPin } = require("./_shared");
const { getSupabase } = require("./_supabase");
const { sendSms } = require("./_sms");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  const supabase = getSupabase();

  try {
    if (event.httpMethod === "GET") {
      const { slug, pin } = event.queryStringParameters || {};
      const school = await verifyPin(supabase, slug, pin);
      const { data, error } = await supabase
        .from("notices")
        .select("*")
        .eq("school_id", school.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ notices: data }) };
    }

    if (event.httpMethod === "POST") {
      // { slug, pin, class: 'all' | 'Class 8', message }
      const body = JSON.parse(event.body || "{}");
      const school = await verifyPin(supabase, body.slug, body.pin);
      const className = body.class || "all";
      const message = body.message;
      if (!message) return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Message zaroori hai" }) };

      const { data: notice, error: nErr } = await supabase
        .from("notices")
        .insert({ school_id: school.id, class: className, message })
        .select()
        .single();
      if (nErr) throw nErr;

      let studentQuery = supabase.from("students").select("parent_phone").eq("school_id", school.id).eq("active", true);
      if (className !== "all") studentQuery = studentQuery.eq("class", className);
      const { data: students, error: sErr } = await studentQuery;
      if (sErr) throw sErr;

      const uniquePhones = [...new Set((students || []).map((s) => s.parent_phone))];
      await Promise.all(uniquePhones.map((phone) => sendSms(phone, `${school.name}: ${message}`, { supabase, schoolId: school.id })));

      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ notice, sentTo: uniquePhones.length }) };
    }

    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (err) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
