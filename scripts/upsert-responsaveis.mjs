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
const CSV_PATH = "/Users/luanantunesdebarros/Downloads/Banco de Dados/Base/Responsaveis.csv";

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
function norm(s) { return (s ?? "").trim().toLowerCase(); }

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

const empresas = await fetchAll("empresas", "id,nome");
const empresaByNome = new Map(empresas.map(e => [norm(e.nome), e.id]));
console.log(`${empresas.length} empresas carregadas pra resolução por nome`);

const rows = parse(readFileSync(CSV_PATH, "utf8"), { columns: true, skip_empty_lines: true, bom: true });

let semEmpresa = 0;
const seenBubbleId = new Set();
const payload = [];
for (const r of rows) {
  const bubbleId = toText(r["unique id"]);
  if (!bubbleId || seenBubbleId.has(bubbleId)) continue;
  seenBubbleId.add(bubbleId);
  const empresaId = empresaByNome.get(norm(r.Empresa)) ?? null;
  if (!empresaId) { semEmpresa++; continue; } // empresa_id é NOT NULL na tabela — sem link, não entra.
  payload.push({
    bubble_id: bubbleId,
    empresa_id: empresaId,
    nome: toText(r["Responsável"]) ?? "Sem nome",
    cargo: toText(r.Cargo),
    email: toText(r.Email),
    linkedin_url: toText(r.Linkedin),
    ordem: r.Ordem ? Number(r.Ordem) : null,
    created_at: toTimestamp(r["Creation Date"]),
    updated_at: toTimestamp(r["Modified Date"]),
  });
}

console.log(`${LIVE ? "LIVE" : "DRY"} — ${payload.length} responsáveis com empresa resolvida (${semEmpresa} sem empresa — ignorados, empresa_id é obrigatório na tabela)`);
console.log("exemplo:", JSON.stringify(payload[0], null, 1));

if (!LIVE) { console.log("\n(dry run)"); process.exit(0); }

const CHUNK = 300;
let done = 0, errors = 0;
for (let i = 0; i < payload.length; i += CHUNK) {
  const chunk = payload.slice(i, i + CHUNK);
  const { error } = await supabase.from("responsaveis").upsert(chunk, { onConflict: "bubble_id" });
  if (error) { console.error(`falhou lote ${i}: ${error.message}`); errors++; }
  else { done += chunk.length; console.log(`OK: ${done}/${payload.length}`); }
}
console.log(`\nResumo: ${done} upsertados, ${errors} lotes com erro.`);
