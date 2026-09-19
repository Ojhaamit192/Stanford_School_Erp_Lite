// Netlify Scheduled Function — runs daily (see netlify.toml).
const { getSupabase } = require("./_supabase");
const { sendSms } = require("./_sms");

exports.handler = async () => {
  const supabase = getSupabase();
  const today = new Date();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");

  const { data: schools, error: schoolErr } = await supabase.from("schools").select("*");
  if (schoolErr) {
    console.error("birthday-wish: could not load schools", schoolErr.message);
    return { statusCode: 500 };
  }

  for (const school of schools) {
    try {
      const { data: students, error: sErr } = await supabase
        .from("students")
        .select("id, name, dob, parent_phone")
        .eq("school_id", school.id)
        .eq("active", true)
        .not("dob", "is", null);
      if (sErr) throw sErr;

      // dob is stored as a full date (YYYY-MM-DD); match month+day only, any year.
      const birthdayKids = (students || []).filter((s) => {
        const [, m, d] = s.dob.split("-");
        return m === mm && d === dd;
      });

      await Promise.all(
        birthdayKids.map((s) =>
          sendSms(
            s.parent_phone,
            `${school.name}: ${s.name} ko aaj janmadin ki bahut bahut shubhkamnayein! 🎂`,
            { supabase, schoolId: school.id }
          )
        )
      );
    } catch (err) {
      console.error(`birthday-wish failed for school ${school.slug}:`, err.message);
    }
  }

  return { statusCode: 200 };
};
