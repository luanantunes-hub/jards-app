import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const dir = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(join(dir, "../.env.local"), "utf8")
    .split("\n")
    .filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const url  = env.NEXT_PUBLIC_SUPABASE_URL;
const key  = env.SUPABASE_SERVICE_ROLE_KEY;

async function sql(query) {
  const r = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify({ sql: query }),
  });
  return r.json();
}

// 1. Add logo_url column
let r = await fetch(`${url}/rest/v1/`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
console.log("Connection:", r.status);

// Use pg-based query via Management API
const mgmt = await fetch(
  `https://api.supabase.com/v1/projects/ykaymbmybellixxvtasi/database/query`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ query: "ALTER TABLE captadores ADD COLUMN IF NOT EXISTS logo_url TEXT;" }),
  }
);
console.log("ALTER TABLE status:", mgmt.status, await mgmt.text());

const bucket = await fetch(`${url}/storage/v1/bucket`, {
  method: "POST",
  headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
  body: JSON.stringify({
    id: "logos",
    name: "logos",
    public: true,
    file_size_limit: 2097152,
    allowed_mime_types: ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"],
  }),
});
console.log("Bucket create:", bucket.status, await bucket.text());
