const { CORS_HEADERS } = require("./_shared");
const { getSupabase } = require("./_supabase");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS_HEADERS, body: "" };

  const masterPassword = process.env.SUPER_ADMIN_PASSWORD;
  const { password } = event.queryStringParameters || {};
  if (!masterPassword || password !== masterPassword) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: "Galat password" }) };
  }

  const supabase = getSupabase();
  const thisMonth = new Date().toISOString().slice(0, 7);
  const from30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  try {
    const { data: schools, error: schoolErr } = await supabase.from("schools").select("id, slug, name");
    if (schoolErr) throw schoolErr;

    const rows = await Promise.all(
      schools.map(async (school) => {
        const [{ count: studentCount }, { data: payments }, { data: attendance }, { count: enquiryCount }, { count: convertedCount }] =
          await Promise.all([
            supabase.from("students").select("id", { count: "exact", head: true }).eq("school_id", school.id).eq("active", true),
            supabase.from("fee_payments").select("amount").eq("school_id", school.id).eq("month", thisMonth),
            supabase.from("attendance").select("status").eq("school_id", school.id).gte("date", from30),
            supabase.from("enquiries").select("id", { count: "exact", head: true }).eq("school_id", school.id),
            supabase.from("enquiries").select("id", { count: "exact", head: true }).eq("school_id", school.id).eq("converted", true),
          ]);

        const collection = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
        const total = attendance?.length || 0;
        const present = (attendance || []).filter((a) => a.status === "present").length;
        const attendancePct = total ? Math.round((present / total) * 100) : null;

        return {
          slug: school.slug,
          name: school.name,
          students: studentCount || 0,
          collectionThisMonth: collection,
          attendancePct,
          enquiries: enquiryCount || 0,
          converted: convertedCount || 0,
        };
      })
    );

    const totals = rows.reduce(
      (acc, r) => ({
        students: acc.students + r.students,
        collection: acc.collection + r.collectionThisMonth,
        enquiries: acc.enquiries + r.enquiries,
        converted: acc.converted + r.converted,
      }),
      { students: 0, collection: 0, enquiries: 0, converted: 0 }
    );

    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ schools: rows, totals }) };
  } catch (err) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
