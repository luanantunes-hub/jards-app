import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ATALHOS_CNAE,
  buscarCnaes,
  cnaeAbrange,
  cnaesCompativeis,
  cnaesDoFornecedor,
  cnaesDoNo,
  descricaoDoCnae,
  formatarCodigoCnae,
  indexarCnaes,
  lerTabelaIbge,
  limparCnaesAceitos,
  nivelDoCnae,
  normalizarCnae,
  sugerirCnaes,
  type TabelaCnae,
} from "../lib/prestacao/cnae";

let tabelaReal: TabelaCnae | null = null;
async function tabela(): Promise<TabelaCnae> {
  tabelaReal ??= JSON.parse(await readFile("public/dados/cnae-subclasses.json", "utf8")) as TabelaCnae;
  return tabelaReal;
}

test("código da CNAE: só algarismos, nos quatro níveis, no formato do IBGE", () => {
  assert.equal(normalizarCnae("9001-9/01"), "9001901");
  assert.equal(normalizarCnae("90.01-9"), "90019");
  assert.equal(normalizarCnae("90.0"), "900");
  assert.equal(normalizarCnae("90"), "90");
  assert.equal(normalizarCnae("9001"), null, "quatro algarismos não é nível da CNAE");
  assert.equal(normalizarCnae(null), null);
  assert.equal(nivelDoCnae("90019"), "classe");
  assert.equal(formatarCodigoCnae("9001901"), "9001-9/01");
  assert.equal(formatarCodigoCnae("90019"), "90.01-9");
  assert.equal(formatarCodigoCnae("900"), "90.0");
  assert.equal(formatarCodigoCnae("90"), "90");
});

test("CNAEs aceitos: o nível mais amplo cobre os de baixo, e a compatibilidade é por prefixo", () => {
  assert.deepEqual(limparCnaesAceitos(["9001-9/01", "90.01-9", "x", "7420-0/01", "7420-0/01"]), ["90019", "7420001"]);
  assert.ok(cnaeAbrange("90", "9001-9/06"));
  assert.ok(cnaeAbrange("90.01-9", "9001906"));
  assert.ok(!cnaeAbrange("90.02-7", "9001906"));

  const fornecedor = { cnae_principal: "9001-9/01", cnaes_secundarios: [{ codigo: "7420-0/01" }, { codigo: "9001-9/01" }, { codigo: "lixo" }] };
  assert.deepEqual(cnaesDoFornecedor(fornecedor), ["9001901", "7420001"]);
  assert.deepEqual(cnaesCompativeis(["742"], cnaesDoFornecedor(fornecedor)), ["7420001"], "o secundário também vale");
  assert.deepEqual(cnaesCompativeis(["5510801"], cnaesDoFornecedor(fornecedor)), []);
  assert.deepEqual(cnaesDoFornecedor({ cnae_principal: null, cnaes_secundarios: null }), []);
});

test("CNAEs do item: os próprios ou os do agrupador mais próximo", () => {
  const nos = [
    { id: "etapa", parent_id: null, nome: "Produção", cnaes_aceitos: ["90"] },
    { id: "meta", parent_id: "etapa", nome: "Espetáculo", cnaes_aceitos: [] },
    { id: "ator", parent_id: "meta", nome: "Ator", cnaes_aceitos: null },
    { id: "foto", parent_id: "meta", nome: "Fotógrafo", cnaes_aceitos: ["7420-0/01"] },
    { id: "solto", parent_id: null, nome: "Seguro", cnaes_aceitos: null },
    { id: "ciclo-a", parent_id: "ciclo-b", nome: "A", cnaes_aceitos: null },
    { id: "ciclo-b", parent_id: "ciclo-a", nome: "B", cnaes_aceitos: null },
  ];
  assert.deepEqual(cnaesDoNo("ator", nos), { cnaes: ["90"], origem: { id: "etapa", nome: "Produção" } });
  assert.deepEqual(cnaesDoNo("foto", nos), { cnaes: ["7420001"], origem: { id: "foto", nome: "Fotógrafo" } }, "o item que define não herda");
  assert.deepEqual(cnaesDoNo("solto", nos), { cnaes: [], origem: null });
  assert.deepEqual(cnaesDoNo("ciclo-a", nos), { cnaes: [], origem: null }, "ciclo não trava");
});

test("tabela do IBGE: lê a resposta da API no formato do arquivo", () => {
  const lida = lerTabelaIbge([
    {
      id: "9001901",
      descricao: "PRODUÇÃO TEATRAL",
      atividades: ["PRODUÇÃO TEATRAL", "ATOR; ATIVIDADE INDEPENDENTE DE", "ATOR; ATIVIDADE INDEPENDENTE DE"],
      classe: { id: "90019", descricao: "ARTES CÊNICAS, ESPETÁCULOS E ATIVIDADES COMPLEMENTARES", grupo: { id: "900", descricao: "ATIVIDADES ARTÍSTICAS, CRIATIVAS E DE ESPETÁCULOS", divisao: { id: "90", descricao: "ATIVIDADES ARTÍSTICAS, CRIATIVAS E DE ESPETÁCULOS" } } },
    },
    { id: "lixo", descricao: "SEM CÓDIGO" },
  ], "https://exemplo", "2026-10-05");
  assert.deepEqual(lida.subclasses, [["9001901", "Produção teatral", ["ator; atividade independente de"]]]);
  assert.equal(lida.niveis["90019"], "Artes cênicas, espetáculos e atividades complementares");
  assert.equal(descricaoDoCnae("90.0", lida), "Atividades artísticas, criativas e de espetáculos");
  assert.equal(descricaoDoCnae("9001-9/01", lida), "Produção teatral");
});

test("arquivo da CNAE: todas as subclasses, e todo atalho aponta para código que existe", async () => {
  const t = await tabela();
  assert.equal(t.subclasses.length, 1332);
  assert.ok(t.fonte.startsWith("https://servicodados.ibge.gov.br/"));
  const codigos = new Set(t.subclasses.map(s => s[0]));
  for (const atalho of ATALHOS_CNAE) {
    for (const c of atalho.cnaes) assert.ok(codigos.has(c), `atalho com CNAE inexistente: ${c} (${atalho.termos[0]})`);
  }
});

test("sugestão: termos de orçamento cultural acham o CNAE certo", async () => {
  const indice = indexarCnaes(await tabela());
  const primeiro = (texto: string) => sugerirCnaes(texto, indice, 6).map(s => s.codigo);
  assert.ok(primeiro("Cachê de ator").includes("9001901"));
  assert.equal(primeiro("Hospedagem Local")[0], "5510801");
  assert.equal(primeiro("Locação de palco")[0], "7739003");
  assert.equal(primeiro("Contador")[0], "6920601");
  assert.equal(primeiro("Cenógrafo")[0], "9001999", "cenografia só aparece nas atividades de artes cênicas");
  assert.equal(primeiro("Tradução em Libras")[0], "7490101");
  assert.deepEqual(sugerirCnaes("de para com", indice), [], "sem palavra útil, sem sugestão");
  // Sem atalho, a busca no texto do IBGE ainda ajuda.
  assert.ok(primeiro("Serviços de chaveiro").includes("9529102"));
});

test("busca de quem escolhe: código de qualquer nível ou palavras pela metade", async () => {
  const indice = indexarCnaes(await tabela());
  const classe = buscarCnaes("90.01-9", indice);
  assert.deepEqual(classe[0], { codigo: "90019", descricao: indice.niveis["90019"], nivel: "classe" });
  assert.ok(classe.slice(1).every(r => r.codigo.startsWith("90019")));
  assert.ok(buscarCnaes("sonori", indice).some(r => r.codigo === "9001906"));
  assert.ok(buscarCnaes("produção teatral", indice).some(r => r.codigo === "9001901"));
  assert.deepEqual(buscarCnaes("   ", indice), []);
});
