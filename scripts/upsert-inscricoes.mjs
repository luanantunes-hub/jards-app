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
const CSV_PATH = "/Users/luanantunesdebarros/Downloads/Banco de Dados/Base/Inscrições.csv";
const CONTA_TESTE_ANTIGA = "luan.antunes@educativoitinerante.com.br";

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
function toDate(v) {
  const ts = toTimestamp(v);
  return ts ? ts.slice(0, 10) : null;
}
function toNumber(v) {
  const s = (v ?? "").trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const STATUS_MAP = { "Enviado": "inscrito", "Pré-Selecionado": "em_analise", "Inscrevendo": "interesse", "Aprovado": "aprovado" };
const PRIORIDADE_MAP = { "ALTO": "alta", "MÉDIO": "media", "BAIXO": "baixa" };
const POTENCIAL_MAP = { "ALTO": "alto", "MÉDIO": "medio", "BAIXO": "baixo" };

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

const empresasCrm = await fetchAll("empresas_crm", "id,bubble_id");
const empresaCrmByBubbleId = new Map(empresasCrm.filter(e => e.bubble_id).map(e => [e.bubble_id, e.id]));

const projetos = await fetchAll("projetos_crm", "id,bubble_id");
const projetoByBubbleId = new Map(projetos.filter(p => p.bubble_id).map(p => [p.bubble_id, p.id]));

console.log(`${profiles.length} profiles, ${memberships.length} memberships, ${empresasCrm.length} empresas_crm, ${projetos.length} projetos_crm carregados`);

const rows = parse(readFileSync(CSV_PATH, "utf8"), { columns: true, skip_empty_lines: true, bom: true });

let semEmpresaCrm = 0, contaTeste = 0, semCriador = 0, statusDesconhecido = 0, semProjeto = 0, aprovadoSemCota = 0;
const seenBubbleId = new Set();
const payload = [];
for (const r of rows) {
  const bubbleId = toText(r["unique id"]);
  if (!bubbleId || seenBubbleId.has(bubbleId)) continue;
  seenBubbleId.add(bubbleId);
  const empresaCrmId = empresaCrmByBubbleId.get(toText(r.empresa_CRM));
  if (!empresaCrmId) { semEmpresaCrm++; continue; }
  const creatorEmail = (toText(r.Creator) ?? "").toLowerCase();
  if (creatorEmail === CONTA_TESTE_ANTIGA) { contaTeste++; continue; }
  const accountId = profileByEmail.get(creatorEmail);
  if (!accountId) { semCriador++; continue; }
  const status = STATUS_MAP[toText(r.Status_Edital) ?? ""];
  if (!status) { statusDesconhecido++; continue; }
  if (status === "aprovado") { aprovadoSemCota++; continue; } // sem cota_id migrável do Bubble — trigger trg_inscricao_sincronizar_cota bloqueia; tratar à parte.
  const projetoId = projetoByBubbleId.get(toText(r.projeto_crm)) ?? null;
  if (!projetoId) semProjeto++;
  const prioridadeBubble = toText(r.prioridade) ?? "";
  payload.push({
    bubble_id: bubbleId,
    account_id: accountId,
    organization_id: orgByUser.get(accountId) ?? null,
    empresa_crm_id: empresaCrmId,
    projeto_id: projetoId,
    valor: toNumber(r.Valor_Edital),
    data_abertura: toDate(r.Edital_Abertura),
    data_fechamento: toDate(r["Edital Fechamento"]),
    data_resultado: toDate(r.Resultado),
    status,
    prioridade: PRIORIDADE_MAP[prioridadeBubble] ?? null,
    potencial_fechamento: POTENCIAL_MAP[prioridadeBubble] ?? "medio",
    observacoes: toText(r["Observações"]) ?? toText(r.Notas),
    created_at: toTimestamp(r["Creation Date"]),
    updated_at: toTimestamp(r["Modified Date"]),
  });
}

console.log(`${LIVE ? "LIVE" : "DRY"} — ${payload.length} inscrições prontas (${semEmpresaCrm} sem empresa CRM, ${contaTeste} da conta de teste antiga, ${semCriador} sem criador migrado, ${statusDesconhecido} status desconhecido/vazio, ${aprovadoSemCota} aprovados sem cota — ignorados; ${semProjeto} sem projeto — não bloqueia)`);
console.log("exemplo:", JSON.stringify(payload[0], null, 1));

if (!LIVE) { console.log("\n(dry run)"); process.exit(0); }

const CHUNK = 300;
let done = 0, errors = 0;
for (let i = 0; i < payload.length; i += CHUNK) {
  const chunk = payload.slice(i, i + CHUNK);
  const { error } = await supabase.from("editais_user").upsert(chunk, { onConflict: "bubble_id" });
  if (error) { console.error(`falhou lote ${i}: ${error.message}`); errors++; }
  else { done += chunk.length; console.log(`OK: ${done}/${payload.length}`); }
}
console.log(`\nResumo: ${done} upsertados, ${errors} lotes com erro.`);
