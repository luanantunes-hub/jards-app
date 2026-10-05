// Move os arquivos da prestação de contas para o caminho da organização
// ({orgId}/prestacoes/{prestacaoId}/...), que é o que as políticas do bucket
// "documentos" exigem. Os caminhos antigos (prestacoes/{id}/... e
// orcamentos/{id}/...) não passam nessas políticas.
//
// Uso:
//   npx tsx scripts/prestacao-migrar-arquivos.ts          # ensaio: só relata
//   npx tsx scripts/prestacao-migrar-arquivos.ts --live   # copia, atualiza a linha e apaga o antigo
//
// Lê NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY do .env.local.
// Pode ser rodado de novo: o destino usa o ID da linha, e linhas já migradas
// são ignoradas.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  lerCaminhoPrestacao,
  montarCaminhoPrestacao,
  organizacaoDaPrestacao,
  SELECT_ORGANIZACAO_DA_PRESTACAO,
  type PastaPrestacao,
} from "../supabase/functions/_shared/prestacao-caminho";

const dir = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(join(dir, "../.env.local"), "utf8")
    .split("\n")
    .filter(linha => linha.includes("=") && !linha.startsWith("#"))
    .map(linha => { const i = linha.indexOf("="); return [linha.slice(0, i).trim(), linha.slice(i + 1).trim()]; }),
);

const LIVE = process.argv.includes("--live");
const BUCKET = "documentos";

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Arquivo = {
  tabela: "prestacao_comprovantes" | "prestacao_atividade_evidencias";
  id: string;
  prestacaoId: string;
  pasta: PastaPrestacao;
  caminho: string;
  nome: string;
};

type Resultado = { migrados: number; jaNoLugar: number; semOrganizacao: string[]; erros: string[] };

async function todas<T>(tabela: string, colunas: string): Promise<T[]> {
  const linhas: T[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase.from(tabela).select(colunas).range(de, de + 999);
    if (error) throw new Error(`${tabela}: ${error.message}`);
    linhas.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return linhas;
  }
}

async function carregarArquivos(): Promise<Arquivo[]> {
  const comprovantes = await todas<{ id: string; prestacao_id: string; storage_path: string; nome_arquivo: string }>(
    "prestacao_comprovantes", "id, prestacao_id, storage_path, nome_arquivo",
  );
  const atividades = await todas<{ id: string; prestacao_id: string }>("prestacao_atividades", "id, prestacao_id");
  const prestacaoDaAtividade = new Map(atividades.map(a => [a.id, a.prestacao_id]));
  const evidencias = await todas<{ id: string; atividade_id: string; storage_path: string; nome_arquivo: string }>(
    "prestacao_atividade_evidencias", "id, atividade_id, storage_path, nome_arquivo",
  );

  return [
    ...comprovantes.map(c => ({
      tabela: "prestacao_comprovantes" as const,
      id: c.id,
      prestacaoId: c.prestacao_id,
      pasta: { tipo: "comprovantes" as const },
      caminho: c.storage_path,
      nome: c.nome_arquivo,
    })),
    ...evidencias.flatMap(e => {
      const prestacaoId = prestacaoDaAtividade.get(e.atividade_id);
      if (!prestacaoId) return [];
      return [{
        tabela: "prestacao_atividade_evidencias" as const,
        id: e.id,
        prestacaoId,
        pasta: { tipo: "atividade" as const, atividadeId: e.atividade_id },
        caminho: e.storage_path,
        nome: e.nome_arquivo,
      }];
    }),
  ];
}

async function organizacoesDasPrestacoes(ids: string[]): Promise<Map<string, string | null>> {
  const mapa = new Map<string, string | null>();
  for (const id of ids) {
    const { data, error } = await supabase.from("prestacoes_contas")
      .select(`${SELECT_ORGANIZACAO_DA_PRESTACAO}, criado_por`)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`prestacoes_contas ${id}: ${error.message}`);
    let org = organizacaoDaPrestacao(data);
    // Sem organização, projeto ou captação: usa a organização em que quem
    // criou é admin, se houver só uma. Mais de uma fica para conferência manual.
    if (!org && data?.criado_por) {
      const { data: membros } = await supabase.from("organization_members")
        .select("organization_id")
        .eq("user_id", data.criado_por)
        .eq("papel", "admin");
      if (membros?.length === 1) org = membros[0].organization_id as string;
    }
    mapa.set(id, org);
  }
  return mapa;
}

async function migrar(arquivo: Arquivo, organizationId: string, resultado: Resultado) {
  let destino: string;
  try {
    destino = montarCaminhoPrestacao({
      organizationId,
      prestacaoId: arquivo.prestacaoId,
      pasta: arquivo.pasta,
      nomeOriginal: arquivo.nome || arquivo.caminho,
      arquivoId: arquivo.id,
    });
  } catch (error) {
    resultado.erros.push(`${arquivo.tabela} ${arquivo.id}: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }
  console.log(`${LIVE ? "mover" : "moveria"}  ${arquivo.caminho}  →  ${destino}`);
  if (!LIVE) { resultado.migrados++; return; }

  const { error: copiaErro } = await supabase.storage.from(BUCKET).copy(arquivo.caminho, destino);
  if (copiaErro && !/exists/i.test(copiaErro.message)) {
    resultado.erros.push(`${arquivo.tabela} ${arquivo.id}: cópia falhou (${copiaErro.message})`);
    return;
  }
  const { error: linhaErro } = await supabase.from(arquivo.tabela).update({ storage_path: destino }).eq("id", arquivo.id);
  if (linhaErro) {
    resultado.erros.push(`${arquivo.tabela} ${arquivo.id}: linha não atualizada (${linhaErro.message}); a cópia ficou em ${destino}`);
    return;
  }
  const { error: remocaoErro } = await supabase.storage.from(BUCKET).remove([arquivo.caminho]);
  if (remocaoErro) resultado.erros.push(`${arquivo.caminho}: migrado, mas o original não foi apagado (${remocaoErro.message})`);
  resultado.migrados++;
}

async function listarRecursivo(prefixo: string): Promise<string[]> {
  const caminhos: string[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefixo, { limit: 1000, offset: de });
    if (error) throw new Error(`listar ${prefixo}: ${error.message}`);
    for (const item of data ?? []) {
      const caminho = `${prefixo}/${item.name}`;
      // Pastas vêm sem id no Storage.
      if (item.id === null) caminhos.push(...await listarRecursivo(caminho));
      else caminhos.push(caminho);
    }
    if (!data || data.length < 1000) return caminhos;
  }
}

async function main() {
  console.log(LIVE ? "Executando a migração." : "Ensaio: nada será alterado. Use --live para executar.");
  const arquivos = await carregarArquivos();
  const pendentes = arquivos.filter(a => !lerCaminhoPrestacao(a.caminho));
  const resultado: Resultado = { migrados: 0, jaNoLugar: arquivos.length - pendentes.length, semOrganizacao: [], erros: [] };

  const organizacoes = await organizacoesDasPrestacoes([...new Set(pendentes.map(a => a.prestacaoId))]);
  for (const arquivo of pendentes) {
    const org = organizacoes.get(arquivo.prestacaoId);
    if (!org) {
      resultado.semOrganizacao.push(`${arquivo.tabela} ${arquivo.id} (prestação ${arquivo.prestacaoId})`);
      continue;
    }
    await migrar(arquivo, org, resultado);
  }

  // Objetos nos prefixos antigos que nenhuma linha usa (ex.: PDFs de orçamento
  // que ficaram para trás). Só relata; apagar é decisão manual.
  const referenciados = new Set(arquivos.map(a => a.caminho));
  const antigos = [...await listarRecursivo("prestacoes"), ...await listarRecursivo("orcamentos")];
  const orfaos = antigos.filter(caminho => !referenciados.has(caminho));

  console.log("\nResumo");
  console.log(`  arquivos nas tabelas: ${arquivos.length}`);
  console.log(`  já no caminho novo:   ${resultado.jaNoLugar}`);
  console.log(`  ${LIVE ? "migrados" : "a migrar"}:            ${resultado.migrados}`);
  console.log(`  sem organização:      ${resultado.semOrganizacao.length}`);
  resultado.semOrganizacao.forEach(item => console.log(`    - ${item}`));
  console.log(`  órfãos nos prefixos antigos (não apagados): ${orfaos.length}`);
  orfaos.forEach(item => console.log(`    - ${item}`));
  if (resultado.erros.length) {
    console.log(`  erros: ${resultado.erros.length}`);
    resultado.erros.forEach(item => console.log(`    - ${item}`));
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
