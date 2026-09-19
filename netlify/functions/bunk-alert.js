// Netlify Scheduled Function — runs daily (see schedule in netlify.toml).
// No pin/query params here: scheduled functions run with no HTTP request
// context, so this loops over every school in one run.
const { getSupabase } = require("./_supabase");
const { sendSms } = require("./_sms");

exports.handler = async () => {
  const supabase = getSupabase();

  const { data: schools, error: schoolErr } = await supabase.from("schools").select("*");
  if (schoolErr) {
    console.error("bunk-alert: could not load schools", schoolErr.message);
    return { statusCode: 500 };
  }

  for (const school of schools) {
    try {
      const { data: students, error: sErr } = await supabase
        .from("students")
        .select("id, name, class")
        .eq("school_id", school.id)
        .eq("active", true);
      if (sErr) throw sErr;
      if (!students?.length) continue;

      const flagged = [];
      for (const student of students) {
        const { data: recent, error: aErr } = await supabase
          .from("attendance")
          .select("status, date")
          .eq("student_id", student.id)
          .order("date", { ascending: false })
          .limit(3);
        if (aErr) throw aErr;
        // Only flag once we actually have 3 marked days and every one is absent —
        // this naturally skips students with gaps (holidays, no attendance taken yet).
        if (recent && recent.length === 3 && recent.every((r) => r.status === "absent")) {
          flagged.push(`${student.name} (${student.class})`);
        }
      }

      if (flagged.length && school.phone) {
        const msg = `${school.name}: In students ka 3 din se lagatar absent hai - ${flagged.join(", ")}. Parents se contact karein.`;
        await sendSms(school.phone, msg, { supabase, schoolId: school.id });
      }
    } catch (err) {
      console.error(`bunk-alert failed for school ${school.slug}:`, err.message);
    }
  }

  return { statusCode: 200 };
};
