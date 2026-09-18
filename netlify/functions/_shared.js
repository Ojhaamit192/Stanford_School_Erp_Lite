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

module.exports = { CORS_HEADERS, todayKey, verifyPin };
