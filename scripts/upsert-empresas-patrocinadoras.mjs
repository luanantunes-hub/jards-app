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
const CSV_PATH = "/Users/luanantunesdebarros/Downloads/Banco de Dados/Base/Empresas patrocinadoras.csv";

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function toBool(v) {
  const s = (v ?? "").trim().toLowerCase();
  if (s === "sim") return true;
  if (s === "não" || s === "nao") return false;
  return null;
}

function toNumber(v) {
  const s = (v ?? "").trim();
  if (!s) return null;
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function toDate(v) {
  const s = (v ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function toTimestamp(v) {
  const s = (v ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function toText(v) {
  const s = (v ?? "").trim();
  return s || null;
}

const rows = parse(readFileSync(CSV_PATH, "utf8"), { columns: true, skip_empty_lines: true, bom: true });

const seen = new Set();
const payload = [];
for (const r of rows) {
  const bubbleId = toText(r["unique id"]);
  if (!bubbleId || seen.has(bubbleId)) continue;
  seen.add(bubbleId);
  payload.push({
    bubble_id: bubbleId,
    nome: toText(r.nome) ?? "Sem nome",
    nome_uppercase: toText(r.nome_uppercase),
    setor: toText(r.setor),
    cidade: toText(r.cidade),
    estado: toText(r.estado),
    site: toText(r.site),
    email_geral: toText(r.email_geral),
    telefone: toText(r.telefone),
    logo_url: toText(r.logo),
    descricao: toText(r.descricao),
    trimestre_1: toBool(r["1t"]),
    trimestre_2: toBool(r["2t"]),
    trimestre_3: toBool(r["3t"]),
    trimestre_4: toBool(r["4t"]),
    aporte_estimado: toNumber(r.aporte_novo),
    tem_detalhe: toBool(r.detalhe),
    edital_titulo: toText(r.edital_titulo),
    edital_acesso: toText(r.edital_acesso),
    edital_abertura: toDate(r.edital_abertura),
    edital_fechamento: toDate(r.edital_fechamento),
    created_at: toTimestamp(r["Creation Date"]),
    updated_at: toTimestamp(r["Modified Date"]),
  });
}

console.log(`${LIVE ? "LIVE RUN" : "DRY RUN"} — ${payload.length} empresas únicas (de ${rows.length} linhas no csv)`);
console.log("Exemplo:", JSON.stringify(payload[0], null, 1));

if (!LIVE) {
  console.log("\n(dry run — nada foi escrito. rode com --live pra executar de verdade)");
  process.exit(0);
}

const CHUNK = 300;
let done = 0, errors = 0;
for (let i = 0; i < payload.length; i += CHUNK) {
  const chunk = payload.slice(i, i + CHUNK);
  const { error } = await supabase.from("empresas").upsert(chunk, { onConflict: "bubble_id" });
  if (error) {
    console.error(`Falhou no lote ${i}-${i + chunk.length}: ${error.message}`);
    errors++;
  } else {
    done += chunk.length;
    console.log(`OK: ${done}/${payload.length}`);
  }
}

console.log(`\nResumo: ${done} upsertados, ${errors} lotes com erro.`);
