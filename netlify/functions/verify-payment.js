const crypto = require("crypto");
const { CORS_HEADERS } = require("./_shared");
const { getSupabase } = require("./_supabase");
const { sendSms } = require("./_sms");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Online payment is not set up yet." }) };
  }

  const supabase = getSupabase();

  try {
    const { slug, phone, roll_no, amount, month, razorpay_order_id, razorpay_payment_id, razorpay_signature } = JSON.parse(event.body || "{}");

    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");
    if (expectedSignature !== razorpay_signature) {
      throw new Error("Payment could not be verified — please contact the school if money was deducted.");
    }

    const { data: school } = await supabase.from("schools").select("*").eq("slug", slug).single();
    if (!school) throw new Error("School not found");
    const { data: student } = await supabase
      .from("students")
      .select("id, name, parent_phone")
      .eq("school_id", school.id)
      .eq("parent_phone", phone)
      .eq("roll_no", roll_no)
      .single();
    if (!student) throw new Error("Student not found");

    const { error: insErr } = await supabase.from("fee_payments").insert({
      school_id: school.id,
      student_id: student.id,
      amount,
      month,
      method: "online",
    });
    if (insErr) throw insErr;

    await sendSms(
      student.parent_phone,
      `${school.name}: Receipt - ${student.name}'s fee of ₹${amount} (${month}) received online. Thank you.`,
      { supabase, schoolId: school.id }
    );

    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
