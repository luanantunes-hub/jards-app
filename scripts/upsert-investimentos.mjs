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
const BASE = "/Users/luanantunesdebarros/Downloads/Banco de Dados/Base/";

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function toNumber(v) {
  const s = (v ?? "").trim();
  if (!s) return null;
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
function toText(v) { const s = (v ?? "").trim(); return s || null; }

const empresas = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await supabase.from("empresas").select("id,bubble_id").range(from, from + 999);
  if (error) throw error;
  empresas.push(...data);
  if (data.length < 1000) break;
}
const empresaByBubbleId = new Map(empresas.map(e => [e.bubble_id, e.id]));
console.log(`${empresas.length} empresas carregadas pra resolução de vínculo`);

async function upsertChunked(table, rows, label) {
  console.log(`\n${label}: ${LIVE ? "LIVE" : "DRY"} — ${rows.length} linhas`);
  console.log("exemplo:", JSON.stringify(rows[0], null, 1));
  if (!LIVE) return;
  const CHUNK = 300;
  let done = 0, errors = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: "bubble_id" });
    if (error) { console.error(`  falhou lote ${i}-${i + chunk.length}: ${error.message}`); errors++; }
    else { done += chunk.length; console.log(`  OK: ${done}/${rows.length}`); }
  }
  console.log(`  resumo ${label}: ${done} upsertados, ${errors} lotes com erro`);
}

// ---- Investimento Anual ----
const anuaisCsv = parse(readFileSync(BASE + "Investimento Anual.csv", "utf8"), { columns: true, skip_empty_lines: true, bom: true });
let anuaisSemEmpresa = 0;
const anuaisRows = [];
for (const r of anuaisCsv) {
  const bubbleId = toText(r["unique id"]);
  if (!bubbleId) continue;
  const empresaId = empresaByBubbleId.get(toText(r.ID));
  if (!empresaId) { anuaisSemEmpresa++; continue; }
  anuaisRows.push({
    bubble_id: bubbleId,
    empresa_pub_id: empresaId,
    nome: toText(r.nome),
    ano_2020: toNumber(r["2020"]),
    ano_2021: toNumber(r["2021"]),
    ano_2022: toNumber(r["2022"]),
    ano_2023: toNumber(r["2023"]),
    ano_2024: toNumber(r["2024"]),
    ano_2025: toNumber(r["2025"]),
    diferenca: toNumber(r["Diferença"]),
  });
}
console.log(`Investimento Anual: ${anuaisRows.length} com empresa resolvida, ${anuaisSemEmpresa} sem empresa (ignoradas)`);
await upsertChunked("investimentos_anuais", anuaisRows, "Investimento Anual");

// ---- Investimento Trimestral ----
const trimCsv = parse(readFileSync(BASE + "Investimento Trimestral.csv", "utf8"), { columns: true, skip_empty_lines: true, bom: true });
let trimSemEmpresa = 0;
const trimRows = [];
const MESES = { janeiro: "Janeiro", fevereiro: "Fevereiro", marco: "Março", abril: "Abril", maio: "Maio", junho: "Junho", julho: "Julho", agosto: "Agosto", setembro: "Setembro", outubro: "Outubro", novembro: "Novembro", dezembro: "Dezembro" };
for (const r of trimCsv) {
  const bubbleId = toText(r["unique id"]);
  if (!bubbleId) continue;
  const empresaId = empresaByBubbleId.get(toText(r.ID));
  if (!empresaId) { trimSemEmpresa++; continue; }
  const row = { bubble_id: bubbleId, empresa_pub_id: empresaId, t1: toNumber(r["1T"]), t2: toNumber(r["2T"]), t3: toNumber(r["3T"]), t4: toNumber(r["4T"]) };
  for (const [col, csvCol] of Object.entries(MESES)) row[col] = toNumber(r[csvCol]);
  trimRows.push(row);
}
console.log(`Investimento Trimestral: ${trimRows.length} com empresa resolvida, ${trimSemEmpresa} sem empresa (ignoradas)`);
await upsertChunked("investimentos_trimestres", trimRows, "Investimento Trimestral");
