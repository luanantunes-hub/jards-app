import assert from "node:assert/strict";
import test from "node:test";
import { type EstadoDaPrestacao } from "../lib/prestacao/checagens";
import { checarBens } from "../lib/prestacao/checagens/checar-bens";
import { despesasSemBem, erroDoBem, faltaNaDoacao, lerCotacoes, listaEmTexto, menorCotacao, type BemParaChecar, type CamposDoBem } from "../lib/prestacao/bens";
import type { NoOrcamento } from "../lib/prestacao/orcamento";
import { regimePorCodigo } from "../lib/prestacao/regimes";

const ROUANET = regimePorCodigo("rouanet_in29_2026")!;

const no = (id: string, nome: string, bem_permanente: boolean): NoOrcamento => ({
  id, versao_id: "v1", parent_id: null, tipo: "item", codigo: null, nome, descricao: null, uf: null, municipio: null,
  grupo_custo: null, unidade: null, quantidade: null, ocorrencias: null, valor_unitario: null, valor_total: 5000,
  valor_remanejado: 0, ordem: 0, bem_permanente,
});
const despesa = (id: string, no_id: string, campos: Partial<EstadoDaPrestacao["despesas"][number]> = {}) =>
  ({ id, no_id, status: "pendente", nome_arquivo: `NF ${id}.pdf`, valor_extraido: 3000, ...campos }) as EstadoDaPrestacao["despesas"][number];
const bem = (campos: Partial<BemParaChecar>): BemParaChecar => ({
  id: "b1", no_id: "i1", despesa_id: "d1", tipo: "equipamento", descricao: "Projetor", valor: null, registro_imovel: null,
  cotacoes: [{ fornecedor: "Loja A", valor: 3000 }], destinacao: "proponente", beneficiario: null,
  doacao_storage_path: null, aceite_storage_path: null, justificativa: null, ...campos,
});
const estado = (bens: BemParaChecar[], campos: Partial<EstadoDaPrestacao> = {}): EstadoDaPrestacao => ({
  regime: ROUANET, fornecedores: [], documentosDosFornecedores: [], itens: [], pagamentos: [], lancamentos: [],
  nos: [no("i1", "Projetor para as oficinas", true), no("i2", "Cachê", false)],
  despesas: [despesa("d1", "i1"), despesa("d2", "i2"), despesa("d3", "i1", { status: "rejeitado" })],
  prestacao: { data_inicio_execucao: "2026-03-01", data_fim_execucao: "2026-12-31" },
  hoje: new Date("2026-10-07T12:00:00Z"),
  bens,
  ...campos,
});

test("despesa de item de bem permanente pede o bem; a recusada e a de outro item, não", () => {
  const achados = checarBens(estado([]));
  assert.deepEqual(achados.map(a => [a.chave, a.severidade]), [["BEM_SEM_CADASTRO:despesa:d1", "alerta"]]);
  assert.match(achados[0].mensagem, /"NF d1\.pdf" é do item "Projetor para as oficinas", marcado como bem permanente/);
  assert.equal(achados[0].fonte?.regra?.codigo, "bens");
  assert.equal(achados[0].fonte?.dispositivo, "art. 69, VI a X");

  const itens = new Set(["i1"]);
  const despesas = [despesa("d1", "i1"), despesa("d4", "i1")];
  assert.deepEqual(despesasSemBem(despesas, itens, [{ no_id: "i1", despesa_id: "d1" }]).map(d => d.id), ["d4"], "o bem da d1 não cobre a d4");
  assert.deepEqual(despesasSemBem(despesas, itens, [{ no_id: "i1", despesa_id: null }]), [], "o bem do item, sem despesa, cobre as duas");
});

test("bem completo e pago pela menor cotação não gera achado", () => {
  assert.deepEqual(checarBens(estado([bem({ cotacoes: [{ fornecedor: "Loja A", valor: 3000 }, { fornecedor: "Loja B", valor: 3400 }] })])), []);
});

test("bem sem destinação, sem cotação e pago acima da menor cotação", () => {
  const achados = checarBens(estado([
    bem({ id: "sem", destinacao: null, cotacoes: [] }),
    bem({ id: "caro", despesa_id: null, valor: 3200, cotacoes: [{ fornecedor: "Loja B", valor: 3400 }, { fornecedor: "Loja A", valor: 2800 }] }),
    bem({ id: "justificado", despesa_id: "d1", cotacoes: [{ fornecedor: "Loja A", valor: 2500 }], justificativa: "A mais barata não entregava antes da estreia." }),
  ]));
  assert.deepEqual(achados.map(a => [a.chave, a.severidade, a.justificativa]), [
    ["BEM_SEM_DESTINACAO:bem:sem", "alerta", null],
    ["BEM_SEM_COTACAO:bem:sem", "alerta", null],
    ["BEM_ACIMA_DA_COTACAO:bem:caro", "justificativa", null],
    ["BEM_ACIMA_DA_COTACAO:bem:justificado", "justificativa", "A mais barata não entregava antes da estreia."],
  ]);
  assert.match(achados[2].mensagem, /pago R\$\s?3\.200,00; a menor cotação foi R\$\s?2\.800,00 \(Loja A\)/);
  assert.match(achados[3].mensagem, /pago R\$\s?3\.000,00/, "o valor pago vem da despesa ligada");
  assert.equal(achados[0].fonte?.dispositivo, "art. 30", "a destinação vem do art. 30");
});

test("sem regra de cotação no regime, não cobra cotação; imóvel pede o registro", () => {
  const semRegime = checarBens(estado([bem({ cotacoes: [] }), bem({ id: "casa", tipo: "imovel", cotacoes: [], despesa_id: null })], { regime: null }));
  assert.deepEqual(semRegime.map(a => a.chave), ["BEM_IMOVEL_SEM_REGISTRO:bem:casa"]);
  const comRegistro = checarBens(estado([bem({ id: "casa", tipo: "imovel", cotacoes: [], registro_imovel: "2º RI de São Paulo, matrícula 1234, folha 56" })]));
  assert.deepEqual(comRegistro, [], "imóvel não pede cotação na Rouanet");
});

test("bem doado: depois do fim da execução, pede quem recebeu, o termo e o aceite", () => {
  const doado = bem({ destinacao: "doacao" });
  assert.deepEqual(checarBens(estado([doado])), [], "antes do fim, nada");
  const depois = { prestacao: { data_inicio_execucao: "2026-03-01", data_fim_execucao: "2026-06-30" } };
  const achados = checarBens(estado([doado], depois));
  assert.deepEqual(achados.map(a => a.chave), ["BEM_DOACAO_SEM_RECIBO:bem:b1"]);
  assert.equal(achados[0].mensagem, `"Projetor" foi doado; falta quem recebeu, o termo de doação e o aceite de quem recebeu.`);
  const completo = bem({ destinacao: "doacao", beneficiario: "Ponto de Cultura Raízes", doacao_storage_path: "x/bens/a.pdf", aceite_storage_path: "x/bens/b.pdf" });
  assert.deepEqual(checarBens(estado([completo], depois)), []);
  assert.deepEqual(faltaNaDoacao({ ...completo, destinacao: "proponente", beneficiario: null }), [], "só a doação pede recibo");
});

test("cotações, lista em texto e o formulário", () => {
  assert.deepEqual(lerCotacoes([{ fornecedor: "A", valor: 10 }, { fornecedor: "B", valor: "dez" }, null, "x"]), [{ fornecedor: "A", valor: 10 }]);
  assert.equal(lerCotacoes("[]").length, 0);
  assert.equal(menorCotacao([{ fornecedor: "A", valor: 10 }, { fornecedor: "B", valor: 8 }])?.fornecedor, "B");
  assert.equal(menorCotacao([]), null);
  assert.equal(listaEmTexto(["a"]), "a");
  assert.equal(listaEmTexto(["a", "b", "c"]), "a, b e c");

  const base: CamposDoBem = {
    tipo: "equipamento", descricao: "Projetor", quantidade: 1, valor: 3000, numero_patrimonio: null, registro_imovel: null,
    cotacoes: [{ fornecedor: "Loja A", valor: 3000 }], destinacao: "doacao", destinacao_descricao: null,
    beneficiario: "Ponto de Cultura", beneficiario_documento: "11.222.333/0001-81", justificativa: null, observacoes: null,
  };
  assert.equal(erroDoBem(base), null);
  assert.match(erroDoBem({ ...base, descricao: " " })!, /Descreva/);
  assert.match(erroDoBem({ ...base, quantidade: 0 })!, /quantidade/);
  assert.match(erroDoBem({ ...base, cotacoes: [1, 2, 3, 4].map(n => ({ fornecedor: `F${n}`, valor: n })) })!, /até 3 cotações/);
  assert.match(erroDoBem({ ...base, cotacoes: [{ fornecedor: "Loja", valor: 0 }] })!, /Loja precisa de um valor/);
  assert.match(erroDoBem({ ...base, destinacao: "outra" })!, /destino/);
  assert.match(erroDoBem({ ...base, beneficiario_documento: "11.222.333/0001-82" })!, /CPF ou CNPJ/);
  assert.match(erroDoBem({ ...base, observacoes: "x".repeat(1001) })!, /1000 caracteres/);
});
