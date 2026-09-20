const { CORS_HEADERS, verifyPin } = require("./_shared");
const { getSupabase } = require("./_supabase");
const { sendSms } = require("./_sms");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  const supabase = getSupabase();

  try {
    if (event.httpMethod === "GET") {
      const { slug, pin, class: className, exam_name, public: isPublic, student } = event.queryStringParameters || {};

      // Public report-card view: no PIN, scoped to one student. Never exposes other students' marks —
      // only their computed rank/out-of, so the link is safe to text to a parent.
      if (isPublic) {
        if (!student) return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "student is required" }) };
        const { data: school, error: schoolErr } = await supabase.from("schools").select("*").eq("slug", slug).single();
        if (schoolErr || !school) throw new Error("School not found");

        const { data: stu, error: stuErr } = await supabase
          .from("students")
          .select("id, name, roll_no, class")
          .eq("id", student)
          .eq("school_id", school.id)
          .single();
        if (stuErr || !stu) throw new Error("Student not found");

        const { data: classResults, error: rErr } = await supabase
          .from("exam_results")
          .select("student_id, exam_name, subject, marks_obtained, max_marks")
          .eq("school_id", school.id);
        if (rErr) throw rErr;

        // Only keep this class's results for rank math; only this student's rows go in the response body.
        const { data: classmates } = await supabase.from("students").select("id").eq("school_id", school.id).eq("class", stu.class);
        const classmateIds = new Set((classmates || []).map((c) => c.id));
        const classWide = (classResults || []).filter((r) => classmateIds.has(r.student_id));

        const myResults = classWide.filter((r) => r.student_id === stu.id);
        const totalsByExam = {};
        classWide.forEach((r) => {
          totalsByExam[r.exam_name] = totalsByExam[r.exam_name] || {};
          totalsByExam[r.exam_name][r.student_id] = (totalsByExam[r.exam_name][r.student_id] || 0) + Number(r.marks_obtained);
        });
        const ranks = {};
        Object.entries(totalsByExam).forEach(([exam, totals]) => {
          const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
          const position = sorted.findIndex(([sid]) => sid === stu.id) + 1;
          if (position > 0) ranks[exam] = { rank: position, outOf: sorted.length };
        });

        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            school: { name: school.name, logo_url: school.logo_url, address: school.address, map_link: school.map_link, enquiry_phone: school.enquiry_phone },
            student: stu,
            results: myResults,
            ranks,
          }),
        };
      }

      // Staff panel only: ?slug&pin&class=Class 8&exam_name=Half Yearly  -> all results for that exam+class
      const school = await verifyPin(supabase, slug, pin);
      let query = supabase
        .from("exam_results")
        .select("*, students(name, roll_no, class, parent_phone)")
        .eq("school_id", school.id)
        .order("created_at", { ascending: false });
      if (exam_name) query = query.eq("exam_name", exam_name);
      const { data, error } = await query;
      if (error) throw error;
      const filtered = className && className !== "all" ? data.filter((r) => r.students?.class === className) : data;
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ results: filtered }) };
    }

    if (event.httpMethod === "POST") {
      // { slug, pin, exam_name, entries: [{student_id, subject, marks_obtained, max_marks}], notify: true }
      const body = JSON.parse(event.body || "{}");
      const school = await verifyPin(supabase, body.slug, body.pin);
      const { exam_name, entries, notify } = body;
      if (!exam_name || !entries?.length) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "exam_name and entries are required" }) };
      }

      const rows = entries.map((e) => ({
        school_id: school.id,
        student_id: e.student_id,
        exam_name,
        subject: e.subject,
        marks_obtained: e.marks_obtained,
        max_marks: e.max_marks || 100,
      }));
      const { data, error } = await supabase.from("exam_results").insert(rows).select();
      if (error) throw error;

      if (notify) {
        // Group by student, send one summary message + report-card link per student.
        const byStudent = {};
        for (const e of entries) {
          byStudent[e.student_id] = byStudent[e.student_id] || [];
          byStudent[e.student_id].push(e);
        }
        const studentIds = Object.keys(byStudent);
        const { data: students } = await supabase.from("students").select("id, name, parent_phone").in("id", studentIds);
        const infoById = Object.fromEntries((students || []).map((s) => [s.id, s]));

        await Promise.all(
          studentIds.map((sid) => {
            const info = infoById[sid];
            if (!info) return null;
            const total = byStudent[sid].reduce((sum, e) => sum + Number(e.marks_obtained), 0);
            const maxTotal = byStudent[sid].reduce((sum, e) => sum + Number(e.max_marks || 100), 0);
            const link = `${process.env.URL || ""}/report-card.html?school=${school.slug}&student=${sid}`;
            const msg = `${school.name}: ${info.name} - ${exam_name} result: ${total}/${maxTotal}. View report card: ${link}`;
            return sendSms(info.parent_phone, msg, { supabase, schoolId: school.id });
          })
        );
      }

      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ saved: data.length }) };
    }

    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (err) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
