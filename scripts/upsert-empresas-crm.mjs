import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";

const dir = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(join(dir, "../.env.local"), "utf8")
    .split("\n")
    .filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const LIVE = process.argv.includes("--live");
const CSV_PATH = "/Users/luanantunesdebarros/Downloads/Banco de Dados/CRM/Empresa_Crm.csv";

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function toText(v) { const s = (v ?? "").trim(); return s || null; }
function toTimestamp(v) {
  const s = (v ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
function isExemplo(nome) { return /\[exemplo\]/i.test(nome ?? ""); }

async function fetchAll(table, cols) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(cols).range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

const profiles = await fetchAll("profiles", "id,email");
const profileByEmail = new Map(profiles.map(p => [(p.email ?? "").trim().toLowerCase(), p.id]));

const memberships = await fetchAll("organization_members", "user_id,organization_id,papel");
const orgByUser = new Map();
for (const m of memberships) if (m.papel === "admin" && !orgByUser.has(m.user_id)) orgByUser.set(m.user_id, m.organization_id);
for (const m of memberships) if (!orgByUser.has(m.user_id)) orgByUser.set(m.user_id, m.organization_id);

console.log(`${profiles.length} profiles, ${memberships.length} memberships carregados`);

const rows = parse(readFileSync(CSV_PATH, "utf8"), { columns: true, skip_empty_lines: true, bom: true });

let exemplo = 0, semCriador = 0, semNome = 0;
const seenBubbleId = new Set();
const payload = [];
for (const r of rows) {
  const bubbleId = toText(r["unique id"]);
  if (!bubbleId || seenBubbleId.has(bubbleId)) continue;
  seenBubbleId.add(bubbleId);
  const nome = toText(r.nome);
  if (!nome) { semNome++; continue; }
  if (isExemplo(nome)) { exemplo++; continue; }
  const creatorEmail = (toText(r.Creator) ?? "").toLowerCase();
  const accountId = profileByEmail.get(creatorEmail);
  if (!accountId) { semCriador++; continue; }
  const organizationId = orgByUser.get(accountId) ?? null;
  payload.push({
    bubble_id: bubbleId,
    account_id: accountId,
    organization_id: organizationId,
    nome,
    nome_key: toText(r.nome_key),
    site: toText(r.site),
    tipo: "prospect",
    cidades_interesse: [],
    leis_que_usa: [],
    janela_decisao: [],
    created_at: toTimestamp(r["Creation Date"]),
    updated_at: toTimestamp(r["Modified Date"]),
  });
}

console.log(`${LIVE ? "LIVE" : "DRY"} — ${payload.length} empresas CRM prontas (${exemplo} [Exemplo] ignoradas, ${semCriador} sem criador migrado, ${semNome} sem nome)`);
console.log("exemplo:", JSON.stringify(payload[0], null, 1));

if (!LIVE) { console.log("\n(dry run)"); process.exit(0); }

const CHUNK = 300;
let done = 0, errors = 0;
for (let i = 0; i < payload.length; i += CHUNK) {
  const chunk = payload.slice(i, i + CHUNK);
  const { error } = await supabase.from("empresas_crm").upsert(chunk, { onConflict: "bubble_id" });
  if (error) { console.error(`falhou lote ${i}: ${error.message}`); errors++; }
  else { done += chunk.length; console.log(`OK: ${done}/${payload.length}`); }
}
console.log(`\nResumo: ${done} upsertados, ${errors} lotes com erro.`);
