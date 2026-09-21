const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

function todayKey() {
  return `queue-${new Date().toISOString().slice(0, 10)}`;
}

// Verifies the admin PIN sent for a school slug, returns the school row on success.
// Shared across all functions so every write action checks the same PIN.
async function verifyPin(supabase, slug, pin) {
  const { data, error } = await supabase.from("schools").select("*").eq("slug", slug).single();
  if (error || !data) throw new Error("School not found");
  if (String(data.admin_pin) !== String(pin)) throw new Error("Wrong PIN");
  return data;
}

// Verifies a teacher's phone + login PIN for a school slug. Returns the
// school and staff rows on success, and the list of classes this teacher
// is allowed to touch (parsed from staff.assigned_classes).
async function verifyStaffLogin(supabase, slug, phone, staffPin) {
  const { data: school, error: schoolErr } = await supabase.from("schools").select("*").eq("slug", slug).single();
  if (schoolErr || !school) throw new Error("School not found");

  const { data: staff, error: staffErr } = await supabase
    .from("staff")
    .select("*")
    .eq("school_id", school.id)
    .eq("phone", phone)
    .eq("active", true)
    .single();
  if (staffErr || !staff) throw new Error("Staff not found");
  if (!staff.login_pin || String(staff.login_pin) !== String(staffPin)) throw new Error("Wrong PIN");

  const allowedClasses = (staff.assigned_classes || "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  return { school, staff, allowedClasses };
}

module.exports = { CORS_HEADERS, todayKey, verifyPin, verifyStaffLogin };
