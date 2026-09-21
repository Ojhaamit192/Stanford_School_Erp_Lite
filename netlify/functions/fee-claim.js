const { CORS_HEADERS, verifyPin } = require("./_shared");
const { getSupabase } = require("./_supabase");
const { sendSms } = require("./_sms");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  const supabase = getSupabase();

  try {
    if (event.httpMethod === "GET") {
      // Staff panel only: ?slug&pin&status=pending -> claims with student info
      const { slug, pin, status } = event.queryStringParameters || {};
      const school = await verifyPin(supabase, slug, pin);
      let query = supabase
        .from("fee_payment_claims")
        .select("*, students(name, roll_no, class)")
        .eq("school_id", school.id)
        .order("created_at", { ascending: false });
      if (status) query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ claims: data }) };
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");

      // Staff action: confirm or reject a claim. { slug, pin, action, claim_id }
      if (body.action === "confirm" || body.action === "reject") {
        const school = await verifyPin(supabase, body.slug, body.pin);
        const { data: claim, error: claimErr } = await supabase
          .from("fee_payment_claims")
          .select("*, students(name, parent_phone)")
          .eq("id", body.claim_id)
          .eq("school_id", school.id)
          .single();
        if (claimErr || !claim) throw new Error("Claim not found");

        if (body.action === "reject") {
          const { error } = await supabase.from("fee_payment_claims").update({ status: "rejected" }).eq("id", claim.id);
          if (error) throw error;
          return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true }) };
        }

        // Confirm: record the real fee payment, mark the claim confirmed, send a receipt.
        const { error: payErr } = await supabase.from("fee_payments").insert({
          school_id: school.id,
          student_id: claim.student_id,
          amount: claim.amount,
          month: claim.month,
          method: "upi",
          receipt_url: claim.screenshot_url,
        });
        if (payErr) throw payErr;

        const { error: updErr } = await supabase.from("fee_payment_claims").update({ status: "confirmed" }).eq("id", claim.id);
        if (updErr) throw updErr;

        if (claim.students?.parent_phone) {
          await sendSms(
            claim.students.parent_phone,
            `${school.name}: Receipt - ${claim.students.name}'s UPI payment of ₹${claim.amount} (${claim.month}) has been confirmed. Thank you.`,
            { supabase, schoolId: school.id }
          );
        }

        return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true }) };
      }

      // Public: parent submits a claim after paying via the UPI QR.
      // { slug, phone, roll_no, amount, month, screenshot_url }
      const { slug, phone, roll_no, amount, month, screenshot_url } = body;
      if (!slug || !phone || !roll_no || !amount || !month) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Amount and month are required" }) };
      }
      const { data: school, error: schoolErr } = await supabase.from("schools").select("*").eq("slug", slug).single();
      if (schoolErr || !school) throw new Error("School not found");
      const { data: student, error: stuErr } = await supabase
        .from("students")
        .select("id, name")
        .eq("school_id", school.id)
        .eq("parent_phone", phone)
        .eq("roll_no", roll_no)
        .eq("active", true)
        .single();
      if (stuErr || !student) throw new Error("Student not found");

      const { data: claim, error: insErr } = await supabase
        .from("fee_payment_claims")
        .insert({ school_id: school.id, student_id: student.id, amount, month, screenshot_url: screenshot_url || null })
        .select()
        .single();
      if (insErr) throw insErr;

      if (school.phone) {
        await sendSms(
          school.phone,
          `${school.name}: ${student.name} says they paid ₹${amount} (${month}) via UPI. Please confirm in the Super Admin panel's Fees tab once you've checked your bank/UPI app.`,
          { supabase, schoolId: school.id }
        );
      }

      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ claim }) };
    }

    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (err) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
