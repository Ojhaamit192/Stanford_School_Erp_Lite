const { CORS_HEADERS, verifyPin } = require("./_shared");
const { getSupabase } = require("./_supabase");

// RazorpayX Payouts is a different product from the regular Razorpay Checkout
// used for fee collection — it needs its own RazorpayX business current
// account (via Razorpay's banking partners), separate KYC, and a funded
// balance to pay out from. See README for the exact setup steps.
async function razorpayXRequest(path, body) {
  const keyId = process.env.RAZORPAYX_KEY_ID || process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAYX_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET;
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const res = await fetch(`https://api.razorpay.com/v1/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.description || `RazorpayX ${path} failed`);
  return data;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const accountNumber = process.env.RAZORPAYX_ACCOUNT_NUMBER;
  const hasKeys = (process.env.RAZORPAYX_KEY_ID || process.env.RAZORPAY_KEY_ID) && (process.env.RAZORPAYX_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET);
  if (!accountNumber || !hasKeys) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "RazorpayX payouts aren't set up yet — use Record for a manual/cash entry instead." }),
    };
  }

  const supabase = getSupabase();

  try {
    const { slug, pin, staff_id, month } = JSON.parse(event.body || "{}");
    const school = await verifyPin(supabase, slug, pin);

    const { data: staff, error: staffErr } = await supabase.from("staff").select("*").eq("id", staff_id).eq("school_id", school.id).single();
    if (staffErr || !staff) throw new Error("Staff not found");
    if (!staff.upi_id) throw new Error(`${staff.name} has no UPI ID on file — add one in the Staff tab first`);

    const contact = await razorpayXRequest("contacts", {
      name: staff.name,
      type: "employee",
      reference_id: staff.id,
    });

    const fundAccount = await razorpayXRequest("fund_accounts", {
      contact_id: contact.id,
      account_type: "vpa",
      vpa: { address: staff.upi_id },
    });

    const payout = await razorpayXRequest("payouts", {
      account_number: accountNumber,
      fund_account_id: fundAccount.id,
      amount: Math.round(staff.monthly_salary * 100),
      currency: "INR",
      mode: "UPI",
      purpose: "salary",
      queue_if_low_balance: true,
      reference_id: `${staff.id}-${month}-${Date.now()}`,
      narration: `Salary ${month}`,
    });

    const { error: insErr } = await supabase.from("staff_salary_payments").insert({
      school_id: school.id,
      staff_id: staff.id,
      amount: staff.monthly_salary,
      month,
      method: "razorpayx_upi",
    });
    if (insErr) throw insErr;

    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true, payout_id: payout.id, status: payout.status }) };
  } catch (err) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
