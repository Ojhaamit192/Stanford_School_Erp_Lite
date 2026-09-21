const { CORS_HEADERS, verifyStaffLogin } = require("./_shared");
const { getSupabase, todayDate } = require("./_supabase");
const { sendSms } = require("./_sms");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  const supabase = getSupabase();

  try {
    if (event.httpMethod === "GET") {
      const { slug, phone, pin, class: className } = event.queryStringParameters || {};
      const { school, allowedClasses } = await verifyStaffLogin(supabase, slug, phone, pin);
      if (!allowedClasses.includes(className)) throw new Error("You are not assigned to this class");

      const { data, error } = await supabase
        .from("homework")
        .select("class, date, text, image_url, created_at")
        .eq("school_id", school.id)
        .eq("class", className)
        .order("date", { ascending: false })
        .limit(10);
      if (error) throw error;
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ homework: data }) };
    }

    if (event.httpMethod === "POST") {
      // { slug, phone, pin, class, date, text, image_url }
      const body = JSON.parse(event.body || "{}");
      const { school, allowedClasses } = await verifyStaffLogin(supabase, body.slug, body.phone, body.pin);
      if (!allowedClasses.includes(body.class)) throw new Error("You are not assigned to this class");
      if (!body.text && !body.image_url) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Homework text or a photo link is required" }) };
      }
      const date = body.date || todayDate();

      const { data: hw, error: hwErr } = await supabase
        .from("homework")
        .insert({ school_id: school.id, class: body.class, date, text: body.text || null, image_url: body.image_url || null })
        .select()
        .single();
      if (hwErr) throw hwErr;

      const { data: students, error: sErr } = await supabase
        .from("students")
        .select("parent_phone")
        .eq("school_id", school.id)
        .eq("class", body.class)
        .eq("active", true);
      if (sErr) throw sErr;

      const uniquePhones = [...new Set((students || []).map((s) => s.parent_phone))];
      const viewLink = `${process.env.URL || ""}/homework.html?school=${school.slug}&class=${encodeURIComponent(body.class)}`;
      const preview = body.text ? body.text.slice(0, 80) : "Photo homework";
      const msg = `${school.name}: Today's homework for ${body.class} - ${preview}. View: ${viewLink}`;
      await Promise.all(uniquePhones.map((p) => sendSms(p, msg, { supabase, schoolId: school.id })));

      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ homework: hw, sentTo: uniquePhones.length }) };
    }

    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (err) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
