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
    // { slug, pin, filename, contentType, dataBase64 } for staff/admin uploads (homework photo, ID card photo, etc.)
    // OR { slug, phone, roll_no, filename, contentType, dataBase64 } for a parent uploading a UPI payment screenshot.
    const body = JSON.parse(event.body || "{}");
    let school;
    if (body.pin) {
      school = await verifyPin(supabase, body.slug, body.pin);
    } else if (body.phone && body.roll_no) {
      const { data: schoolRow, error: schoolErr } = await supabase.from("schools").select("*").eq("slug", body.slug).single();
      if (schoolErr || !schoolRow) throw new Error("School not found");
      const { data: student, error: stuErr } = await supabase
        .from("students")
        .select("id")
        .eq("school_id", schoolRow.id)
        .eq("parent_phone", body.phone)
        .eq("roll_no", body.roll_no)
        .eq("active", true)
        .single();
      if (stuErr || !student) throw new Error("Student not found");
      school = schoolRow;
    } else {
      throw new Error("Not authorized");
    }

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
