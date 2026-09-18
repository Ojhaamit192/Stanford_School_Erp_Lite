const { CORS_HEADERS, verifyPin } = require("./_shared");
const { getSupabase, todayDate } = require("./_supabase");
const { sendSms } = require("./_sms");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  const supabase = getSupabase();

  try {
    if (event.httpMethod === "GET") {
      // Two uses:
      // 1) Staff panel (needs pin): ?slug&pin&class=Class 7  -> last 10 entries for that class
      // 2) Public view page (no pin): ?slug&class=Class 7&public=1 -> last 5 entries, school name only
      const { slug, pin, class: className, public: isPublic } = event.queryStringParameters || {};
      const { data: school, error: schoolErr } = await supabase.from("schools").select("*").eq("slug", slug).single();
      if (schoolErr || !school) throw new Error("School not found");
      if (!isPublic) await verifyPin(supabase, slug, pin);

      let query = supabase
        .from("homework")
        .select("class, date, text, image_url, created_at")
        .eq("school_id", school.id)
        .order("date", { ascending: false })
        .limit(isPublic ? 5 : 10);
      if (className && className !== "all") query = query.eq("class", className);
      const { data, error } = await query;
      if (error) throw error;
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ school: { name: school.name }, homework: data }),
      };
    }

    if (event.httpMethod === "POST") {
      // { slug, pin, class, date, text, image_url }
      const body = JSON.parse(event.body || "{}");
      const school = await verifyPin(supabase, body.slug, body.pin);
      const className = body.class;
      if (!className || (!body.text && !body.image_url)) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Class aur text/photo link mein se kam se kam ek zaroori hai" }) };
      }
      const date = body.date || todayDate();

      const { data: hw, error: hwErr } = await supabase
        .from("homework")
        .insert({ school_id: school.id, class: className, date, text: body.text || null, image_url: body.image_url || null })
        .select()
        .single();
      if (hwErr) throw hwErr;

      const { data: students, error: sErr } = await supabase
        .from("students")
        .select("parent_phone")
        .eq("school_id", school.id)
        .eq("class", className)
        .eq("active", true);
      if (sErr) throw sErr;

      const uniquePhones = [...new Set((students || []).map((s) => s.parent_phone))];
      const viewLink = `${process.env.URL || ""}/homework.html?school=${school.slug}&class=${encodeURIComponent(className)}`;
      const preview = body.text ? body.text.slice(0, 80) : "Photo homework";
      const msg = `${school.name}: ${className} ka aaj ka homework - ${preview}${viewLink ? `. Dekhein: ${viewLink}` : ""}`;

      await Promise.all(uniquePhones.map((phone) => sendSms(phone, msg)));

      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ homework: hw, sentTo: uniquePhones.length }) };
    }

    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (err) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
