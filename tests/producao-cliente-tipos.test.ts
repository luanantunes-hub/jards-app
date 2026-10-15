import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import type { Alteracao, Linha, NovaLinha } from "../lib/producao/banco";
import { clienteDaProducao, type ClienteDaProducao } from "../lib/producao/cliente";
import type { TipoData } from "../lib/producao/vocabulario";
import type { Database } from "../lib/supabase/types";

// PD0.11: o aceite da entrega é "o typecheck acusa coluna inexistente nas consultas da produção". Quem confere é
// o compilador, então a prova é de tempo de compilação: as funções abaixo só existem para `npm run typecheck`
// (nenhuma é chamada). Cada consulta que tem de dar erro está numa linha só, logo abaixo de um `@ts-expect-error`:
// se ela deixar de dar erro, o próprio compilador reclama da diretiva sem uso. As consultas certas, na primeira
// função, garantem que o erro vem do tipo da produção e não de um cliente quebrado: se o tipo estragar, elas
// deixam de compilar. Os testes de baixo conferem o que o compilador não vê: que o cliente é o mesmo do app, e
// que este arquivo é mesmo compilado.

const ORG = "00000000-0000-4000-8000-000000000001";
const ID = "00000000-0000-4000-8000-000000000002";

/** Tudo o que a produção promete que compila. */
export async function consultasQueTemDeCompilar(c: ClienteDaProducao, bloco: Linha<"producao_blocos">) {
  // Ler: as colunas da tabela, o filtro, a ordem; o tipo da data sai como valor da lista, não como texto qualquer.
  const { data: datas } = await c.from("producao_datas").select("data, tipo, situacao, uf").eq("temporada_id", ID).order("data");
  const tipos: TipoData[] = datas?.map(linha => linha.tipo) ?? [];
  // Juntar tabelas da produção pela chave que o tipo descreve (Relationships).
  const { data: comTemporada } = await c.from("producao_datas").select("data, producao_temporadas(titulo)");
  const titulos: string[] = comTemporada?.map(linha => linha.producao_temporadas.titulo) ?? [];
  // A chave no outro sentido vira lista (os blocos da data), e a que aceita nulo vira nulo (a sala da data).
  const { data: comBlocos } = await c.from("producao_datas").select("id, producao_blocos(id, inicio), producao_salas(nome)");
  const horas: (string | null)[] = comBlocos?.flatMap(linha => linha.producao_blocos.map(bloco => bloco.inicio)) ?? [];
  const salas: (string | undefined)[] = comBlocos?.map(linha => linha.producao_salas?.nome) ?? [];
  // Inserir: só o que é obrigatório; o que aceita nulo ou tem padrão pode faltar.
  c.from("producao_obras").insert({ organization_id: ORG, tipo: "show", titulo: "Meu show" });
  c.from("producao_temporadas").insert({ organization_id: ORG, formato: "turne", lado: "circula", tipo: "show", titulo: "Turnê" });
  c.from("producao_datas").insert({ organization_id: ORG, temporada_id: ID, data: "2026-10-15", tipo: "ensaio", situacao: "confirmada" });
  // Alterar e apagar.
  c.from("producao_datas").update({ situacao: "confirmada", opcao_ordem: null, opcao_ate: null }).eq("id", ID);
  c.from("producao_blocos").delete().eq("data_id", ID);
  // Funções que o navegador executa, com nulo onde elas aceitam.
  c.rpc("auth_producao_pode", { p_org: ORG, p_acao: "editar" });
  c.rpc("auth_producao_ve_temporada", { p_org: ORG, p_temporada_id: null });
  c.rpc("fn_producao_definir_funcao", { p_org: ORG, p_user: ID, p_dinheiro: true, p_alcada: null, p_escopo: "vinculado" });
  // Os tipos das linhas: nulo só onde a coluna aceita; o valor da lista fechada é a lista.
  const novaData: NovaLinha<"producao_datas"> = { organization_id: ORG, temporada_id: ID, data: "2026-10-15" };
  const mudanca: Alteracao<"producao_blocos"> = { exibicao: "oculta", confirmado: true };
  const exibicao: "exata" | "aproximada" | "a_definir" | "oculta" = bloco.exibicao;
  const inicio: string | null = bloco.inicio;
  return { tipos, titulos, horas, salas, novaData, mudanca, exibicao, inicio };
}

/** Os três clientes que o app já usa (navegador, servidor e serviço) viram o cliente da produção. */
export function osTresClientesDoApp(
  navegador: ReturnType<typeof import("../lib/supabase/client").createClient>,
  servidor: Awaited<ReturnType<typeof import("../lib/supabase/server").createClient>>,
  servico: ReturnType<typeof import("../lib/supabase/admin").createAdminClient>,
): ClienteDaProducao[] {
  return [clienteDaProducao(navegador), clienteDaProducao(servidor), clienteDaProducao(servico)];
}

/** Tudo o que o compilador tem de recusar. */
export async function consultasQueTemDeDarErro(c: ClienteDaProducao, bloco: Linha<"producao_blocos">) {
  // @ts-expect-error tabela que não existe
  c.from("producao_tabela_que_nao_existe");
  // @ts-expect-error tabela de fora da produção: esta o cliente comum do app lê
  c.from("organizations");
  // @ts-expect-error coluna que não existe no select (a biblioteca não recusa o texto, mas a linha vira SelectQueryError, e usar qualquer campo dela dá erro)
  (await c.from("producao_datas").select("data, tipo, coluna_que_nao_existe")).data?.map(linha => linha.tipo);
  // @ts-expect-error junção que não existe (a tabela existe, mas não há chave entre as duas): o campo da linha dá erro
  (await c.from("producao_obras").select("id, producao_blocos(id)")).data?.map(linha => linha.producao_blocos.id);
  // @ts-expect-error coluna que não existe no filtro
  c.from("producao_datas").select("data").eq("coluna_que_nao_existe", 1);
  // @ts-expect-error coluna que não existe ao inserir
  c.from("producao_obras").insert({ organization_id: ORG, tipo: "show", titulo: "T", coluna_que_nao_existe: 1 });
  // @ts-expect-error coluna que não existe ao alterar
  c.from("producao_datas").update({ coluna_que_nao_existe: 1 });
  // @ts-expect-error coluna que não existe na linha
  String(bloco.coluna_que_nao_existe);
  // @ts-expect-error campo obrigatório faltando no insert: a organização
  c.from("producao_obras").insert({ tipo: "show", titulo: "Sem organização" });
  // @ts-expect-error campo obrigatório faltando no insert: o tipo
  c.from("producao_obras").insert({ organization_id: ORG, titulo: "Sem tipo" });
  // @ts-expect-error campo obrigatório faltando no insert: a temporada da data
  c.from("producao_datas").insert({ organization_id: ORG, data: "2026-10-15" });
  // @ts-expect-error valor fora da lista fechada: o lado da temporada
  c.from("producao_temporadas").insert({ organization_id: ORG, formato: "turne", lado: "invalido", tipo: "show", titulo: "T" });
  // @ts-expect-error valor fora da lista fechada: o tipo da data não é o tipo da produção (show)
  c.from("producao_datas").insert({ organization_id: ORG, temporada_id: ID, data: "2026-10-15", tipo: "show" });
  // @ts-expect-error valor fora da lista fechada: a situação da data, ao alterar
  c.from("producao_datas").update({ situacao: "adiada" });
  // @ts-expect-error valor fora da lista fechada: a exibição da hora do bloco
  c.from("producao_blocos").insert({ organization_id: ORG, data_id: ID, dia: "2026-10-15", tipo: "sessao", exibicao: "escondida" });
  // @ts-expect-error valor fora da lista fechada: a ação do histórico
  c.from("producao_historico").insert({ organization_id: ORG, entidade: "producao_blocos", entidade_id: ID, acao: "mexeu" });
  // @ts-expect-error o id do histórico é gerado pelo banco
  c.from("producao_historico").insert({ id: 1, organization_id: ORG, entidade: "producao_blocos", entidade_id: ID, acao: "criou" });
  // @ts-expect-error a linha traz qualquer valor da lista, não um só
  const so: "exata" = bloco.exibicao;
  // @ts-expect-error função que não existe
  c.rpc("funcao_que_nao_existe");
  // @ts-expect-error função interna: o navegador não a executa
  c.rpc("auth_producao_ficha", { p_org: ORG });
  // @ts-expect-error argumento que falta
  c.rpc("auth_producao_pode", { p_org: ORG });
  // @ts-expect-error argumento fora da lista fechada: o escopo
  c.rpc("fn_producao_definir_funcao", { p_org: ORG, p_user: ID, p_dinheiro: true, p_alcada: null, p_escopo: "todos" });
  // @ts-expect-error a alçada tem de ser dita: nula quando a pessoa não aprova
  c.rpc("fn_producao_definir_funcao", { p_org: ORG, p_user: ID, p_dinheiro: true, p_escopo: "organizacao" });
  // @ts-expect-error o recorte aceita nulo, mas a organização não
  c.rpc("auth_producao_ve_temporada", { p_org: null, p_temporada_id: ID });
  // @ts-expect-error o que se converte é o cliente do Supabase, não qualquer objeto
  clienteDaProducao({ from: () => null });
  return so;
}

// ─── O que o compilador não vê ──────────────────────────────────────────────────────────────────────────────

/** Um cliente do supabase-js com um banco de mentira (o do navegador e o do servidor do app são este mesmo cliente, com a sessão em cookie). */
function appComBancoFalso() {
  const chamadas: { url: URL; metodo: string; corpo: string | null }[] = [];
  const app = createClient<Database>("http://localhost:54321", "chave-anonima-de-teste", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (entrada, init) => {
        const url = new URL(typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
        chamadas.push({ url, metodo: init?.method ?? "GET", corpo: typeof init?.body === "string" ? init.body : null });
        return new Response(url.pathname.includes("/rpc/") ? "true" : "[]", { status: 200, headers: { "content-type": "application/json" } });
      },
    },
  });
  return { app, chamadas };
}

test("o cliente da produção é o mesmo do app, só com outro tipo: mesma conexão, sem embrulho", () => {
  const { app } = appComBancoFalso();
  assert.equal(clienteDaProducao(app), app);
});

test("a consulta tipada chega ao banco como qualquer outra: a mesma tabela, as mesmas colunas, o mesmo filtro", async () => {
  const { app, chamadas } = appComBancoFalso();
  const producao = clienteDaProducao(app);

  const { data, error } = await producao.from("producao_datas").select("data, tipo").eq("temporada_id", ID).order("data");
  assert.equal(error, null);
  assert.deepEqual(data, []);
  const leitura = chamadas[0];
  assert.equal(leitura.metodo, "GET");
  assert.equal(leitura.url.pathname, "/rest/v1/producao_datas");
  assert.equal(leitura.url.searchParams.get("select"), "data,tipo");
  assert.equal(leitura.url.searchParams.get("temporada_id"), `eq.${ID}`);
  assert.equal(leitura.url.searchParams.get("order"), "data.asc");

  const { data: pode } = await producao.rpc("auth_producao_pode", { p_org: ORG, p_acao: "editar" });
  assert.equal(pode, true);
  const funcao = chamadas[1];
  assert.equal(funcao.metodo, "POST");
  assert.equal(funcao.url.pathname, "/rest/v1/rpc/auth_producao_pode");
  assert.deepEqual(JSON.parse(funcao.corpo ?? "null"), { p_org: ORG, p_acao: "editar" });
});

test("este arquivo entra no typecheck: o tsconfig inclui tests/ e não o exclui", async () => {
  const config: { include?: string[]; exclude?: string[] } = JSON.parse(await readFile("tsconfig.json", "utf8"));
  assert.ok(config.include?.includes("**/*.ts"), "tsconfig.json não inclui **/*.ts");
  assert.ok(!(config.exclude ?? []).some(caminho => /^(\.\/)?tests(\/|$)/.test(caminho)), "tsconfig.json exclui tests/");
});
