const { CORS_HEADERS, verifyPin } = require("./_shared");
const { getSupabase } = require("./_supabase");

const BUCKET = "school-photos";
const MAX_BYTES = 4 * 1024 * 1024; // 4MB — keep SMS-link pages light and fast on weak internet

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const supabase = getSupabase();

  try {
    // { slug, pin, filename, contentType, dataBase64 }
    const body = JSON.parse(event.body || "{}");
    const school = await verifyPin(supabase, body.slug, body.pin);
    const { filename, contentType, dataBase64 } = body;
    if (!dataBase64 || !contentType) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Photo data missing" }) };
    }

    const buffer = Buffer.from(dataBase64, "base64");
    if (buffer.length > MAX_BYTES) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Photo is larger than 4MB, please send a smaller one" }) };
    }

    const safeName = (filename || "photo").replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${school.slug}/${Date.now()}-${safeName}`;

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, buffer, {
      contentType,
      upsert: false,
    });
    if (upErr) throw upErr;

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);

    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ url: pub.publicUrl }) };
  } catch (err) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
