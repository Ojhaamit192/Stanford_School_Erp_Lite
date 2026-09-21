const { CORS_HEADERS } = require("./_shared");
const { getSupabase } = require("./_supabase");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Online payment is not set up yet. Please pay by cash at the school for now." }),
    };
  }

  const supabase = getSupabase();

  try {
    const { slug, phone, roll_no, amount, month } = JSON.parse(event.body || "{}");
    const { data: school } = await supabase.from("schools").select("id, name").eq("slug", slug).single();
    if (!school) throw new Error("School not found");
    const { data: student } = await supabase
      .from("students")
      .select("id, name, monthly_fee")
      .eq("school_id", school.id)
      .eq("parent_phone", phone)
      .eq("roll_no", roll_no)
      .eq("active", true)
      .single();
    if (!student) throw new Error("Student not found");

    const payAmount = amount || student.monthly_fee;
    if (!payAmount || payAmount <= 0) throw new Error("Invalid amount");

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
      body: JSON.stringify({
        amount: Math.round(payAmount * 100), // Razorpay wants paise
        currency: "INR",
        receipt: `${student.id}-${month}`,
        notes: { student_id: student.id, student_name: student.name, month, school: school.name },
      }),
    });
    const order = await res.json();
    if (!res.ok) throw new Error(order.error?.description || "Could not create payment order");

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ order_id: order.id, amount: order.amount, currency: order.currency, key_id: keyId, student_name: student.name }),
    };
  } catch (err) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
