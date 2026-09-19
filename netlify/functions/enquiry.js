const { CORS_HEADERS, verifyPin } = require("./_shared");
const { getSupabase } = require("./_supabase");
const { sendSms } = require("./_sms");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  const supabase = getSupabase();

  if (event.httpMethod === "GET") {
    // Staff panel only: ?slug&pin -> recent enquiries for the Dashboard tab
    try {
      const { slug, pin } = event.queryStringParameters || {};
      const school = await verifyPin(supabase, slug, pin);
      const { data, error } = await supabase
        .from("enquiries")
        .select("id, name, phone, class_interested, converted, created_at")
        .eq("school_id", school.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ enquiries: data }) };
    } catch (err) {
      return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
    }
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");

    if (body.action === "convert") {
      // Staff-only: { slug, pin, action: 'convert', id }
      const school = await verifyPin(supabase, body.slug, body.pin);
      const { error } = await supabase.from("enquiries").update({ converted: true }).eq("id", body.id).eq("school_id", school.id);
      if (error) throw error;
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true }) };
    }

    // Public: parent submits from the directory page. { slug, name, phone, class_interested }
    const { slug, name, phone, class_interested } = body;
    if (!slug || !name || !phone) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Naam aur phone zaroori hai" }) };
    }

    const { data: school, error: schoolErr } = await supabase.from("schools").select("*").eq("slug", slug).single();
    if (schoolErr || !school) throw new Error("School not found");

    const { error: insErr } = await supabase
      .from("enquiries")
      .insert({ school_id: school.id, name, phone, class_interested: class_interested || null });
    if (insErr) throw insErr;

    if (school.phone) {
      const msg = `${school.name}: Nayi admission enquiry - ${name} (${phone})${class_interested ? `, ${class_interested} ke liye` : ""}. Call back karein.`;
      await sendSms(school.phone, msg, { supabase, schoolId: school.id });
    }

    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
