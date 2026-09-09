/**
 * JARDS — Migração Bubble → Supabase
 *
 * Lê os dois CSVs exportados do Bubble e insere os dados no Supabase
 * usando a service_role key (ignora RLS).
 *
 * Uso:
 *   npx tsx supabase/seed_from_bubble.ts
 *
 * Variáveis necessárias no .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";

// ─── Config ────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const CSV_EMPRESAS      = path.resolve(process.env.HOME!, "Downloads/export_todos-os-campos_2026-05-26_03-24-01.csv");
const CSV_RESPONSAVEIS  = path.resolve(process.env.HOME!, "Downloads/export_All-respons-veis-modified--_2026-05-26_03-24-48.csv");

// ─── Cliente com service_role (bypassa RLS) ─────────────────────────────────
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// ─── Helpers ────────────────────────────────────────────────────────────────
function parseBoolean(val: string): boolean {
  return val?.trim().toLowerCase() === "sim";
}

function parseDate(val: string): string | null {
  if (!val || val.trim() === "") return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
}

function parseNumeric(val: string): number | null {
  if (!val || val.trim() === "") return null;
  const n = parseFloat(val.replace(",", "."));
  return isNaN(n) ? null : n;
}

async function batchInsert<T extends object>(
  table: string,
  rows: T[],
  batchSize = 200
) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).upsert(batch, {
      onConflict: "bubble_id",
      ignoreDuplicates: false,
    });
    if (error) {
      console.error(`❌ Erro no batch ${i}–${i + batchSize} de ${table}:`, error.message);
      process.exit(1);
    }
    inserted += batch.length;
    process.stdout.write(`\r  ${table}: ${inserted}/${rows.length}`);
  }
  console.log(`\r  ✅ ${table}: ${inserted} registros`);
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🚀 Iniciando migração Bubble → Supabase\n");

  // ── 0. Limpa dados anteriores (editais não têm bubble_id, não dá upsert) ──
  console.log("🧹 Limpando dados anteriores...");
  await supabase.from("editais").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("responsaveis").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("empresas").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  console.log("  ✅ Limpo\n");

  // ── 1. Empresas ────────────────────────────────────────────────────────────
  console.log("📦 Lendo empresas...");
  const rawEmpresas = parse(fs.readFileSync(CSV_EMPRESAS, "utf-8"), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  const empresasRows = rawEmpresas.map((r) => ({
    bubble_id:       r["unique id"],
    nome:            r["nome"] || "(sem nome)",
    nome_uppercase:  r["nome_uppercase"] || null,
    setor:           r["setor"] || null,
    cidade:          r["cidade"] || null,
    estado:          r["estado"] || null,
    site:            r["site"] || null,
    email_geral:     r["email_geral"] || null,
    telefone:        r["telefone"] || null,
    logo_url:        r["logo"] || null,
    descricao:       r["descricao"] || null,
    trimestre_1:     parseBoolean(r["1t"]),
    trimestre_2:     parseBoolean(r["2t"]),
    trimestre_3:     parseBoolean(r["3t"]),
    trimestre_4:     parseBoolean(r["4t"]),
    aporte_estimado: parseNumeric(r["aporte_novo"]),
    tem_detalhe:     parseBoolean(r["detalhe"]),
  }));

  await batchInsert("empresas", empresasRows);

  // ── 2. Busca mapa bubble_id → UUID (paginado, sem limite de 1000) ──────────
  console.log("\n🗺️  Carregando mapa de IDs...");
  let allEmps: { id: string; bubble_id: string }[] = [];
  let page = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("empresas")
      .select("id, bubble_id")
      .range(page * PAGE, (page + 1) * PAGE - 1);
    if (error) { console.error("❌", error.message); process.exit(1); }
    if (!data || data.length === 0) break;
    allEmps = allEmps.concat(data);
    if (data.length < PAGE) break;
    page++;
  }

  const idMap = new Map(allEmps.map((e) => [e.bubble_id, e.id]));
  console.log(`  ✅ ${idMap.size} empresas mapeadas`);

  // ── 3. Editais (extraídos dos campos inline do Bubble) ─────────────────────
  console.log("\n📋 Gerando editais...");
  const editaisRows = rawEmpresas
    .filter((r: Record<string, string>) => r["edital_titulo"]?.trim())
    .map((r: Record<string, string>) => {
      const empresaId = idMap.get(r["unique id"]);
      if (!empresaId) return null;
      return {
        empresa_id:     empresaId,
        titulo:         r["edital_titulo"] || null,
        data_abertura:  parseDate(r["edital_abertura"]),
        data_fechamento: parseDate(r["edital_fechamento"]),
        url_acesso:     r["edital_acesso"] || null,
        ativo:          true,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  // Editais não têm bubble_id — insert simples (não upsert)
  let editaisInserted = 0;
  const batchSize = 200;
  for (let i = 0; i < editaisRows.length; i += batchSize) {
    const batch = editaisRows.slice(i, i + batchSize);
    const { error } = await (supabase as any).from("editais").insert(batch);
    if (error) {
      console.error(`❌ Erro batch editais ${i}:`, error.message);
      process.exit(1);
    }
    editaisInserted += batch.length;
    process.stdout.write(`\r  editais: ${editaisInserted}/${editaisRows.length}`);
  }
  console.log(`\r  ✅ editais: ${editaisInserted} registros`);

  // ── 4. Responsáveis ────────────────────────────────────────────────────────
  console.log("\n👤 Lendo responsáveis...");
  const rawResp = parse(fs.readFileSync(CSV_RESPONSAVEIS, "utf-8"), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  const responsaveisRows = rawResp
    .map((r) => {
      // Campo "ID" no CSV dos responsáveis = bubble_id da empresa
      const empresaId = idMap.get(r["ID"]);
      if (!empresaId) {
        console.warn(`  ⚠️  Empresa não encontrada para responsável "${r["Responsável"]}" (Empresa ID: ${r["Empresa"]})`);
        return null;
      }
      return {
        bubble_id:   r["unique id"],
        empresa_id:  empresaId,
        nome:        r["Responsável"] || "(sem nome)",
        cargo:       r["Cargo"] || null,
        email:       r["Email"] || null,
        linkedin_url: r["Linkedin"] || null,
        ordem:       parseInt(r["Ordem"] || "1", 10),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  await (batchInsert as any)("responsaveis", responsaveisRows);

  console.log("\n✅ Migração concluída!\n");
}

main().catch((e) => {
  console.error("❌ Erro fatal:", e);
  process.exit(1);
});
