const { CORS_HEADERS, verifyPin } = require("./_shared");
const { getSupabase } = require("./_supabase");
const { sendSms } = require("./_sms");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  const supabase = getSupabase();

  try {
    if (event.httpMethod === "GET") {
      // ?slug&pin&month=2026-09  -> returns every active student with paid/due status for that month
      const { slug, pin, month } = event.queryStringParameters || {};
      const school = await verifyPin(supabase, slug, pin);
      const targetMonth = month || new Date().toISOString().slice(0, 7);

      const { data: students, error: sErr } = await supabase
        .from("students")
        .select("id, name, class, roll_no, parent_phone, monthly_fee")
        .eq("school_id", school.id)
        .eq("active", true);
      if (sErr) throw sErr;

      const { data: payments, error: pErr } = await supabase
        .from("fee_payments")
        .select("student_id, amount, paid_on, month")
        .eq("school_id", school.id)
        .eq("month", targetMonth);
      if (pErr) throw pErr;

      const paidSet = new Set((payments || []).map((p) => p.student_id));
      const result = (students || []).map((s) => ({
        ...s,
        paid: paidSet.has(s.id),
      }));

      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ month: targetMonth, students: result }) };
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const school = await verifyPin(supabase, body.slug, body.pin);

      if (body.action === "reminder") {
        // { action: 'reminder', student_id }
        const { data: student, error } = await supabase
          .from("students")
          .select("name, parent_phone, monthly_fee")
          .eq("id", body.student_id)
          .single();
        if (error) throw error;
        await sendSms(
          student.parent_phone,
          `${school.name}: ${student.name} ki is mahine ki fee (₹${student.monthly_fee}) abhi due hai. Kripya jald bhugtan karein.`,
          { supabase, schoolId: school.id }
        );
        return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ sent: true }) };
      }

      // Record a payment: { slug, pin, student_id, amount, month, method }
      const { student_id, amount, month, method } = body;
      if (!student_id || !amount) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "student_id aur amount zaroori hai" }) };
      }
      const targetMonth = month || new Date().toISOString().slice(0, 7);

      const { data: payment, error: payErr } = await supabase
        .from("fee_payments")
        .insert({ school_id: school.id, student_id, amount, month: targetMonth, method: method || "cash" })
        .select()
        .single();
      if (payErr) throw payErr;

      const { data: student } = await supabase.from("students").select("name, parent_phone").eq("id", student_id).single();
      if (student) {
        await sendSms(
          student.parent_phone,
          `${school.name}: Rasid - ${student.name} ki fees ₹${amount} (${targetMonth}) mil gayi hai. Dhanyawad.`,
          { supabase, schoolId: school.id }
        );
      }

      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ payment }) };
    }

    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (err) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
