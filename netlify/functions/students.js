const { CORS_HEADERS, verifyPin } = require("./_shared");
const { getSupabase } = require("./_supabase");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  const supabase = getSupabase();

  try {
    if (event.httpMethod === "GET") {
      const { slug, pin, class: className } = event.queryStringParameters || {};
      const school = await verifyPin(supabase, slug, pin);
      let query = supabase.from("students").select("*").eq("school_id", school.id).eq("active", true).order("class").order("name");
      if (className && className !== "all") query = query.eq("class", className);
      const { data, error } = await query;
      if (error) throw error;
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ school, students: data }) };
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const school = await verifyPin(supabase, body.slug, body.pin);

      // Edit an existing student — used for attaching a photo/DOB later, or fixing a phone number.
      if (body.action === "update") {
        const { id, name, class: className, roll_no, father_name, mother_name, parent_phone, monthly_fee, dob, photo_url } = body;
        if (!id) return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Student id is required" }) };
        const patch = {};
        if (name !== undefined) patch.name = name;
        if (className !== undefined) patch.class = className;
        if (roll_no !== undefined) patch.roll_no = roll_no || null;
        if (father_name !== undefined) patch.father_name = father_name || null;
        if (mother_name !== undefined) patch.mother_name = mother_name || null;
        if (parent_phone !== undefined) patch.parent_phone = parent_phone;
        if (monthly_fee !== undefined) patch.monthly_fee = monthly_fee || 0;
        if (dob !== undefined) patch.dob = dob || null;
        if (photo_url !== undefined) patch.photo_url = photo_url || null;

        const { data, error } = await supabase
          .from("students")
          .update(patch)
          .eq("id", id)
          .eq("school_id", school.id)
          .select()
          .single();
        if (error) throw error;
        return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ student: data }) };
      }

      // Bulk import from the Excel upload in the Students tab.
      // { action: 'bulk', rows: [{ name, class, roll_no, father_name, mother_name, parent_phone, monthly_fee, dob }] }
      if (body.action === "bulk") {
        const rows = body.rows || [];
        const toInsert = rows
          .filter((r) => r.name && r.class && r.parent_phone)
          .map((r) => ({
            school_id: school.id,
            name: String(r.name).trim(),
            class: String(r.class).trim(),
            roll_no: r.roll_no ? String(r.roll_no).trim() : null,
            father_name: r.father_name ? String(r.father_name).trim() : null,
            mother_name: r.mother_name ? String(r.mother_name).trim() : null,
            parent_phone: String(r.parent_phone).trim(),
            monthly_fee: Number(r.monthly_fee) || 0,
            dob: r.dob || null,
          }));
        if (!toInsert.length) {
          return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "No valid rows found — each row needs at least name, class and parent phone" }) };
        }
        const { data, error } = await supabase.from("students").insert(toInsert).select();
        if (error) throw error;
        return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ inserted: data.length, skipped: rows.length - toInsert.length }) };
      }

      // Default: create one student (the Add Student form).
      const { name, class: className, roll_no, father_name, mother_name, parent_phone, monthly_fee, dob, photo_url } = body;
      if (!name || !className || !parent_phone) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Name, class and parent phone are required" }) };
      }
      const { data, error } = await supabase
        .from("students")
        .insert({
          school_id: school.id,
          name,
          class: className,
          roll_no: roll_no || null,
          father_name: father_name || null,
          mother_name: mother_name || null,
          parent_phone,
          monthly_fee: monthly_fee || 0,
          dob: dob || null,
          photo_url: photo_url || null,
        })
        .select()
        .single();
      if (error) throw error;
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ student: data }) };
    }

    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (err) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
