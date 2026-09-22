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
      // only their computed rank/out-of, so the link is safe to text to a parent. Only shows exams that
      // have actually been published for that student's class — a result being entered isn't the same
      // as it being released.
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

        const { data: publications, error: pubErr } = await supabase
          .from("result_publications")
          .select("exam_name")
          .eq("school_id", school.id)
          .eq("class", stu.class);
        if (pubErr) throw pubErr;
        const publishedExamNames = new Set((publications || []).map((p) => p.exam_name));

        const { data: classResults, error: rErr } = await supabase
          .from("exam_results")
          .select("student_id, exam_name, subject, marks_obtained, max_marks, theory_max, theory_obtained, internal_max, internal_obtained")
          .eq("school_id", school.id);
        if (rErr) throw rErr;

        // Only keep this class's PUBLISHED results for rank math; only this student's rows go in the response body.
        const { data: classmates } = await supabase.from("students").select("id").eq("school_id", school.id).eq("class", stu.class);
        const classmateIds = new Set((classmates || []).map((c) => c.id));
        const classWide = (classResults || []).filter((r) => classmateIds.has(r.student_id) && publishedExamNames.has(r.exam_name));

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

      // Staff panel: ?slug&pin&class=Class 8&exam_name=Half Yearly -> all results for that exam+class
      // (published or not — staff need to review drafts before publishing), plus which exam names are
      // already published for that class.
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

      let publishedExamNames = [];
      if (className && className !== "all") {
        const { data: pubs, error: pubErr } = await supabase
          .from("result_publications")
          .select("exam_name")
          .eq("school_id", school.id)
          .eq("class", className);
        if (pubErr) throw pubErr;
        publishedExamNames = (pubs || []).map((p) => p.exam_name);
      }

      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ results: filtered, publishedExamNames }) };
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const school = await verifyPin(supabase, body.slug, body.pin);

      // Publish (or unpublish) every result already entered for a class+exam — this is the only
      // point where parents get notified/see the result; entering marks alone never does.
      if (body.action === "publish" || body.action === "unpublish") {
        const { class: className, exam_name } = body;
        if (!className || !exam_name) {
          return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "class and exam_name are required" }) };
        }

        if (body.action === "unpublish") {
          const { error } = await supabase
            .from("result_publications")
            .delete()
            .eq("school_id", school.id)
            .eq("class", className)
            .eq("exam_name", exam_name);
          if (error) throw error;
          return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true }) };
        }

        const { error: pubErr } = await supabase
          .from("result_publications")
          .upsert({ school_id: school.id, class: className, exam_name, published_at: new Date().toISOString() }, { onConflict: "school_id,class,exam_name" });
        if (pubErr) throw pubErr;

        // Notify every student in this class who has a result for this exam.
        const { data: classResults, error: rErr } = await supabase
          .from("exam_results")
          .select("student_id, marks_obtained, max_marks, students!inner(name, class, parent_phone)")
          .eq("school_id", school.id)
          .eq("exam_name", exam_name)
          .eq("students.class", className);
        if (rErr) throw rErr;

        const byStudent = {};
        (classResults || []).forEach((r) => {
          byStudent[r.student_id] = byStudent[r.student_id] || { total: 0, max: 0, info: r.students };
          byStudent[r.student_id].total += Number(r.marks_obtained);
          byStudent[r.student_id].max += Number(r.max_marks);
        });

        await Promise.all(
          Object.entries(byStudent).map(([sid, v]) => {
            const link = `${process.env.URL || ""}/report-card.html?school=${school.slug}&student=${sid}`;
            const msg = `${school.name}: ${v.info.name} - ${exam_name} result published: ${v.total}/${v.max}. View report card: ${link}`;
            return sendSms(v.info.parent_phone, msg, { supabase, schoolId: school.id });
          })
        );

        return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true, notified: Object.keys(byStudent).length }) };
      }

      // Marks entry — saves the marks only. Nothing is visible to parents and no SMS goes out
      // until the class+exam is explicitly published (see the "publish" action above).
      // { slug, pin, exam_name, subject, theory_max, internal_max, entries: [{student_id, theory_obtained, internal_obtained}] }
      // theory_max/internal_max are optional — if omitted, entries may instead carry marks_obtained/max_marks (a single combined score).
      const { exam_name, subject, entries, max_marks, theory_max, internal_max } = body;
      if (!exam_name || !entries?.length) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "exam_name and entries are required" }) };
      }

      const hasSplit = theory_max !== undefined && internal_max !== undefined;
      const tMax = hasSplit ? Number(theory_max) || 0 : null;
      const iMax = hasSplit ? Number(internal_max) || 0 : null;
      const rows = entries.map((e) => {
        const tObt = hasSplit ? Number(e.theory_obtained) || 0 : null;
        const iObt = hasSplit ? Number(e.internal_obtained) || 0 : null;
        const marks_obtained = hasSplit ? tObt + iObt : Number(e.marks_obtained) || 0;
        const marksMax = hasSplit ? tMax + iMax : e.max_marks || max_marks || 100;
        return {
          school_id: school.id,
          student_id: e.student_id,
          exam_name,
          subject: e.subject || subject,
          marks_obtained,
          max_marks: marksMax,
          theory_max: tMax,
          theory_obtained: tObt,
          internal_max: iMax,
          internal_obtained: iObt,
        };
      });
      const { data, error } = await supabase.from("exam_results").insert(rows).select();
      if (error) throw error;

      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ saved: data.length }) };
    }

    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (err) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
