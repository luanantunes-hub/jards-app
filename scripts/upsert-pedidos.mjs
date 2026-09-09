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
const CSV_PATH = "/Users/luanantunesdebarros/Downloads/Banco de Dados/Base/Pedidos.csv";

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

const STATUS_MAP = { Pendente: "pendente", Entregue: "concluida" };

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

const empresas = await fetchAll("empresas", "id,bubble_id");
const empresaByBubbleId = new Map(empresas.map(e => [e.bubble_id, e.id]));

const profiles = await fetchAll("profiles", "id,email");
const profileByEmail = new Map(profiles.map(p => [(p.email ?? "").trim().toLowerCase(), p.id]));

const memberships = await fetchAll("organization_members", "user_id,organization_id,papel");
const orgByUser = new Map();
for (const m of memberships) if (m.papel === "admin" && !orgByUser.has(m.user_id)) orgByUser.set(m.user_id, m.organization_id);
for (const m of memberships) if (!orgByUser.has(m.user_id)) orgByUser.set(m.user_id, m.organization_id);

console.log(`${empresas.length} empresas, ${profiles.length} profiles, ${memberships.length} memberships carregados`);

const rows = parse(readFileSync(CSV_PATH, "utf8"), { columns: true, skip_empty_lines: true, bom: true });

let semEmpresa = 0, semUsuario = 0, semOrg = 0, statusDesconhecido = 0, duplicados = 0;
const seenPair = new Set();
const payload = [];
for (const r of rows) {
  const bubbleId = toText(r["unique id"]);
  if (!bubbleId) continue;
  const empresaId = empresaByBubbleId.get(toText(r.empresa));
  const solicitanteId = profileByEmail.get((toText(r.Usuario) ?? "").toLowerCase());
  if (!empresaId) { semEmpresa++; continue; }
  if (!solicitanteId) { semUsuario++; continue; }
  const organizationId = orgByUser.get(solicitanteId);
  if (!organizationId) { semOrg++; continue; }
  const status = STATUS_MAP[toText(r.Status_Pedido) ?? ""];
  if (!status) { statusDesconhecido++; continue; }
  // uma empresa só tem 1 solicitação por organização (constraint única) — mantém a primeira ocorrência.
  const pairKey = `${organizationId}:${empresaId}`;
  if (seenPair.has(pairKey)) { duplicados++; continue; }
  seenPair.add(pairKey);
  const createdAt = toTimestamp(r["Creation Date"]);
  payload.push({
    bubble_id: bubbleId,
    empresa_id: empresaId,
    solicitante_id: solicitanteId,
    organization_id: organizationId,
    status,
    prioridade: 1,
    created_at: createdAt,
    updated_at: toTimestamp(r["Modified Date"]) ?? createdAt,
    concluida_em: status === "concluida" ? (toTimestamp(r["Modified Date"]) ?? createdAt) : null,
  });
}

console.log(`${LIVE ? "LIVE" : "DRY"} — ${payload.length} pedidos prontos (${semEmpresa} sem empresa, ${semUsuario} sem usuário, ${semOrg} sem organização, ${statusDesconhecido} status desconhecido, ${duplicados} duplicados org+empresa — ignorados)`);
console.log("exemplo:", JSON.stringify(payload[0], null, 1));

if (!LIVE) { console.log("\n(dry run)"); process.exit(0); }

const CHUNK = 300;
let done = 0, errors = 0;
for (let i = 0; i < payload.length; i += CHUNK) {
  const chunk = payload.slice(i, i + CHUNK);
  const { error } = await supabase.from("solicitacoes_pesquisa_empresa").upsert(chunk, { onConflict: "bubble_id" });
  if (error) { console.error(`falhou lote ${i}: ${error.message}`); errors++; }
  else { done += chunk.length; console.log(`OK: ${done}/${payload.length}`); }
}
console.log(`\nResumo: ${done} upsertados, ${errors} lotes com erro.`);
