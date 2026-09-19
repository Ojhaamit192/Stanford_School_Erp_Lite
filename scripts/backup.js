// Exports every table in the ERP to CSV files under backups/<date>/.
// Run by .github/workflows/backup.yml on a nightly schedule, or manually:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backup.js
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const TABLES = ["schools", "students", "attendance", "fee_payments", "notices", "exam_results", "homework"];

function toCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lines = [headers.join(",")];
  for (const row of rows) lines.push(headers.map((h) => escape(row[h])).join(","));
  return lines.join("\n");
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const dateFolder = new Date().toISOString().slice(0, 10);
  const outDir = path.join(__dirname, "..", "backups", dateFolder);
  fs.mkdirSync(outDir, { recursive: true });

  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select("*");
    if (error) {
      console.error(`Failed to export ${table}:`, error.message);
      continue;
    }
    fs.writeFileSync(path.join(outDir, `${table}.csv`), toCsv(data || []));
    console.log(`Exported ${table}: ${data.length} rows`);
  }
}

main();
