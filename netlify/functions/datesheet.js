const { CORS_HEADERS, verifyPin } = require("./_shared");
const { getSupabase } = require("./_supabase");
const { sendSms } = require("./_sms");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  const supabase = getSupabase();

  try {
    if (event.httpMethod === "GET") {
      // Two uses, same as homework.js:
      // 1) Staff panel (needs pin): ?slug&pin&class=Class 7
      // 2) Public view page (no pin): ?slug&class=Class 7&public=1
      const { slug, pin, class: className, public: isPublic } = event.queryStringParameters || {};
      const { data: school, error: schoolErr } = await supabase.from("schools").select("*").eq("slug", slug).single();
      if (schoolErr || !school) throw new Error("School not found");
      if (!isPublic) await verifyPin(supabase, slug, pin);

      let query = supabase
        .from("datesheets")
        .select("class, exam_name, text, created_at")
        .eq("school_id", school.id)
        .order("created_at", { ascending: false })
        .limit(isPublic ? 3 : 10);
      if (className && className !== "all") query = query.eq("class", className);
      const { data, error } = await query;
      if (error) throw error;
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ school: { name: school.name }, datesheets: data }) };
    }

    if (event.httpMethod === "POST") {
      // { slug, pin, class, exam_name, text }
      const body = JSON.parse(event.body || "{}");
      const school = await verifyPin(supabase, body.slug, body.pin);
      const className = body.class;
      const examName = body.exam_name;
      const text = body.text;
      if (!className || !examName || !text) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Class, exam name and datesheet text are required" }) };
      }

      const { data: ds, error: dsErr } = await supabase
        .from("datesheets")
        .insert({ school_id: school.id, class: className, exam_name: examName, text })
        .select()
        .single();
      if (dsErr) throw dsErr;

      const { data: students, error: sErr } = await supabase
        .from("students")
        .select("parent_phone")
        .eq("school_id", school.id)
        .eq("class", className)
        .eq("active", true);
      if (sErr) throw sErr;

      const uniquePhones = [...new Set((students || []).map((s) => s.parent_phone))];
      const viewLink = `${process.env.URL || ""}/datesheet.html?school=${school.slug}&class=${encodeURIComponent(className)}`;
      const msg = `${school.name}: ${className} - ${examName} Datesheet:\n${text}${viewLink ? `\nView: ${viewLink}` : ""}`;

      await Promise.all(uniquePhones.map((phone) => sendSms(phone, msg, { supabase, schoolId: school.id })));

      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ datesheet: ds, sentTo: uniquePhones.length }) };
    }

    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (err) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
