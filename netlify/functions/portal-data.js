const { CORS_HEADERS } = require("./_shared");
const { getSupabase } = require("./_supabase");

async function verifyStudent(supabase, slug, phone, roll_no) {
  const { data: school, error: schoolErr } = await supabase.from("schools").select("*").eq("slug", slug).single();
  if (schoolErr || !school) throw new Error("School not found");
  const { data: student, error: stuErr } = await supabase
    .from("students")
    .select("*")
    .eq("school_id", school.id)
    .eq("parent_phone", phone)
    .eq("roll_no", roll_no)
    .eq("active", true)
    .single();
  if (stuErr || !student) throw new Error("Student not found");
  return { school, student };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  }
  const supabase = getSupabase();

  try {
    const { slug, phone, roll_no } = event.queryStringParameters || {};
    const { school, student } = await verifyStudent(supabase, slug, phone, roll_no);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
    const today = now.toISOString().slice(0, 10);
    const thisMonthKey = now.toISOString().slice(0, 7);

    const [{ data: attendance }, { data: payments }, { data: homework }, { data: datesheets }, { data: results }, { data: publications }] = await Promise.all([
      supabase.from("attendance").select("date, status").eq("student_id", student.id).gte("date", yearStart).lte("date", today),
      supabase.from("fee_payments").select("month, amount, paid_on").eq("student_id", student.id).order("month", { ascending: false }),
      supabase.from("homework").select("date, text, image_url").eq("school_id", school.id).eq("class", student.class).order("date", { ascending: false }).limit(5),
      supabase.from("datesheets").select("exam_name, text, created_at").eq("school_id", school.id).eq("class", student.class).order("created_at", { ascending: false }).limit(3),
      supabase.from("exam_results").select("exam_name").eq("student_id", student.id),
      supabase.from("result_publications").select("exam_name").eq("school_id", school.id).eq("class", student.class),
    ]);

    let monthPresent = 0, monthTotal = 0, yearPresent = 0, yearTotal = 0;
    (attendance || []).forEach((a) => {
      yearTotal += 1;
      if (a.status === "present") yearPresent += 1;
      if (a.date >= monthStart) {
        monthTotal += 1;
        if (a.status === "present") monthPresent += 1;
      }
    });

    const paidThisMonth = (payments || []).some((p) => p.month === thisMonthKey);
    const publishedSet = new Set((publications || []).map((p) => p.exam_name));
    const examNames = [...new Set((results || []).map((r) => r.exam_name))].filter((name) => publishedSet.has(name));

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        school: { name: school.name, logo_url: school.logo_url, slug: school.slug, upi_id: school.upi_id, upi_qr_url: school.upi_qr_url },
        student,
        attendance: {
          monthPct: monthTotal ? Math.round((monthPresent / monthTotal) * 100) : null,
          yearPct: yearTotal ? Math.round((yearPresent / yearTotal) * 100) : null,
        },
        fees: {
          monthlyFee: student.monthly_fee,
          paidThisMonth,
          thisMonthKey,
          history: payments || [],
        },
        homework: homework || [],
        datesheets: datesheets || [],
        examNames,
      }),
    };
  } catch (err) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
