import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as XLSX from "xlsx";
import type { DespesaDoEstado, EstadoDaPrestacao } from "../lib/prestacao/checagens";
import type { NoOrcamento } from "../lib/prestacao/orcamento";
import {
  agenciaDoStr,
  codigoDoBanco,
  criticasQueBloqueiam,
  fonteSugerida,
  historicoDoStr,
  planilhasDoStr,
  salicDoStr,
  type ContaDoStr,
} from "../lib/prestacao/planilhas-str";
import { gravarDe, gravarDo, gravarRp } from "../lib/prestacao/planilhas-str-xls";
import { regimePorCodigo } from "../lib/prestacao/regimes";
import type { PrestacaoFornecedor } from "../lib/supabase/types";

// P7.3: RP, DE e DO no layout do STR (Manual STR – Planilhas v2.2) e as
// críticas de carga e de envio, sobre os modelos oficiais da IN 159.

const MODELOS = "docs/acoes-futuras/estudos/prestacao-de-contas-fontes/modelos-oficiais/ancine/";
const modelo = (nome: string) => readFileSync(`${MODELOS}IN_159_${nome}.xls`);
const IN159 = regimePorCodigo("ancine_in159_2021")!;

test("campos do STR: SALIC, banco, agência, histórico e fonte do DO", () => {
  assert.equal(salicDoStr("21-0123"), "21-0123");
  assert.equal(salicDoStr("210123"), "21-0123");
  assert.equal(salicDoStr("2021-0123"), null);
  assert.equal(codigoDoBanco("Banco do Brasil"), "001");
  assert.equal(codigoDoBanco("001 - Banco do Brasil"), "001");
  assert.equal(codigoDoBanco("341"), "341");
  assert.equal(codigoDoBanco("Caixa Econômica Federal"), "104");
  assert.equal(codigoDoBanco("Banco Desconhecido"), null);
  assert.equal(agenciaDoStr("1234-X"), "1234");
  assert.equal(agenciaDoStr("0123-4"), "01234");
  assert.equal(historicoDoStr(`TED ${"X".repeat(80)}`).length, 60);
  assert.equal(fonteSugerida("Art. 1º-A da Lei do Audiovisual"), "art1a");
  assert.equal(fonteSugerida("art 3o-A lei 8.685"), "art3a");
  assert.equal(fonteSugerida("Artigo 1º"), "art1");
  assert.equal(fonteSugerida("Lei Rouanet (8.313)"), "rouanet");
  assert.equal(fonteSugerida("FSA – Prodecine 01"), "fsa");
  assert.equal(fonteSugerida("incentivo fiscal"), null);
});

// ─── Cenário ────────────────────────────────────────────────────────────────

const no = (id: string, nome: string, valor_total: number, parent_id: string | null, ordem: number): NoOrcamento => ({
  id, nome, versao_id: "v1", parent_id, tipo: parent_id === null && valor_total === 0 ? "grupo" : "item", codigo: null, descricao: null, uf: null, municipio: null,
  grupo_custo: null, unidade: null, quantidade: null, ocorrencias: null, valor_unitario: null, valor_total, valor_remanejado: 0, ordem,
});

const despesa = (id: string, campos: Partial<DespesaDoEstado>): DespesaDoEstado => ({
  id, nome_arquivo: `${id}.pdf`, status: "pendente", no_id: "i1", tipo: "nfe", data_doc: "2026-03-01", valor_extraido: 1000,
  fornecedor_id: "f1", numero_documento: "123", chave_acesso: null, iss: 0, inss: 0, irrf: 0, outras_retencoes: 0,
  identificacao_projeto: "presente", justificativa: null, valor_liquido: null, ...campos,
});

const fornecedor = (id: string, documento: string, razao_social: string) => ({ id, documento, razao_social, nome: null, tipo_pessoa: documento.length === 11 ? "pf" : "pj" }) as unknown as PrestacaoFornecedor;

const lanc = (id: string, conta_id: string, data: string, natureza: "credito" | "debito", valor: number, historico: string, categoria: string) =>
  ({ id, conta_id, data, natureza, valor, historico, numero_documento: null, numero_normalizado: null, categoria });

const pag = (id: string, despesa_id: string, valor: number, lancamento_id: string | null, data = "2026-03-05") =>
  ({ id, despesa_id, forma: "ted", data, valor, favorecido_documento: null, numero_documento: null, lancamento_id });

const CONTAS: ContaDoStr[] = [
  { id: "cap", tipo: "captacao", banco: "Banco do Brasil", agencia: "1234-X", conta: "11111-1", apelido: "Captação" },
  { id: "mov", tipo: "movimento", banco: "001", agencia: "1234", conta: "22222-2", apelido: "Movimentação" },
];

function cenario(): EstadoDaPrestacao {
  return {
    regime: IN159,
    nos: [
      no("g1", "Produção", 0, null, 1),
      no("i1", "Câmera", 60_000, "g1", 1),
      no("i2", "Montagem", 35_000, "g1", 2),
      no("i3", "Gerenciamento", 5_000, null, 2),
    ],
    itens: [],
    fornecedores: [fornecedor("f1", "11222333000181", "Locadora Ltda"), fornecedor("f2", "52998224725", "Ana Souza"), fornecedor("f3", "12345678900", "CPF Errado")],
    documentosDosFornecedores: [],
    despesas: [
      despesa("camera", { valor_extraido: 10_000, no_id: "i1" }),
      despesa("recibo", { tipo: "recibo", valor_extraido: 2_000, no_id: "i2", fornecedor_id: "f2", numero_documento: "7" }),
      despesa("rpa", { tipo: "rpa", valor_extraido: 1_000, no_id: "i2", fornecedor_id: "f3", numero_documento: "A-9" }),
      despesa("doacao", { valor_extraido: 5_000, no_id: "i2", contrapartida: "doacao", numero_documento: "55" }),
      despesa("sem_item", { valor_extraido: 300, no_id: null }),
      despesa("recusada", { valor_extraido: 999, status: "rejeitado" }),
    ],
    pagamentos: [
      pag("p1", "camera", 10_000, "l-ted"),
      pag("p2", "recibo", 2_000, "l-pix", "2026-03-10"),
      pag("p3", "rpa", 1_000, "l-pix", "2026-03-10"),
      pag("p4", "sem_item", 300, null),
    ],
    lancamentos: [
      lanc("l-aporte", "cap", "2026-02-01", "credito", 100_000, "DEPOSITO ART 1-A", "aporte"),
      lanc("l-transf-c", "cap", "2026-02-05", "debito", 95_000, "TRANSF MOVIMENTACAO", "transferencia"),
      lanc("l-rend", "cap", "2026-02-28", "credito", 120, "RENDIMENTO", "rendimento"),
      lanc("l-transf-m", "mov", "2026-02-05", "credito", 95_000, "TRANSF CAPTACAO", "transferencia"),
      lanc("l-ted", "mov", "2026-03-05", "debito", 10_000, "TED 62.501 LOCADORA", "pagamento"),
      lanc("l-tar", "mov", "2026-03-05", "debito", 12.5, "TARIFA TED", "tarifa"),
      lanc("l-pix", "mov", "2026-03-10", "debito", 3_000, "PIX 123", "pagamento"),
    ],
  } as unknown as EstadoDaPrestacao;
}

const DADOS = { titulo: "Filme Teste", identificador: "21-0123", proponente: "Produtora Teste Ltda", valorAprovado: null };

test("RP: uma linha por pagamento conciliado, com histórico e data do débito; a contrapartida fora da conta tem RP própria", () => {
  const p = planilhasDoStr({ estado: cenario(), contas: CONTAS, prestacao: DADOS, fonte: "art1a" });
  assert.deepEqual(p.rps.map(r => r.arquivo), ["RP_21-0123_22222-2.xls", "RP_21-0123_CONTRAPARTIDA.xls"]);
  const [mov, contrapartida] = p.rps;
  assert.deepEqual([mov.banco, mov.agencia, mov.conta], ["001", "1234", "22222-2"]);
  assert.deepEqual(mov.linhas.map(l => [l.item, l.credor, l.documento, l.historico, l.dataPagamento, l.tipoDocumento, l.valor]), [
    ["1.1", "Locadora Ltda", "11222333000181", "TED 62.501 LOCADORA", "2026-03-05", "NF", 1_000_000],
    ["1.2", "Ana Souza", "52998224725", "PIX 123", "2026-03-10", "Recibo", 200_000],
    ["1.2", "CPF Errado", "12345678900", "PIX 123", "2026-03-10", "RPA", 100_000],
  ]);
  assert.equal(mov.total, 1_300_000);
  assert.deepEqual([contrapartida.banco, contrapartida.conta], ["CONTRAPARTIDA", "CONTRAP"]);
  assert.deepEqual(contrapartida.linhas.map(l => [l.item, l.historico, l.dataPagamento, l.valor]), [["1.2", "CONTRAPARTIDA", "2026-03-01", 500_000]]);
});

test("DE: uma por conta, com as colunas e o sinal do manual e o saldo corrido", () => {
  const p = planilhasDoStr({ estado: cenario(), contas: CONTAS, prestacao: DADOS, fonte: "art1a" });
  const [cap, mov] = p.des;
  assert.equal(cap.contaDe, "CAPTAÇÃO");
  assert.deepEqual(cap.linhas.map(l => [l.fomento, l.transferencias, l.aplicacoes, l.saldo]), [[10_000_000, 0, 0, 10_000_000], [0, -9_500_000, 0, 500_000], [0, 0, 12_000, 512_000]]);
  assert.equal(mov.contaDe, "MOVIMENTAÇÃO");
  assert.deepEqual(mov.totais, { fomento: 0, outros: 0, transferencias: 9_500_000, aplicacoes: 0, pagamentos: 1_300_000, despesasBancarias: 1_250, saldo: 8_198_750 });
});

test("DO: a árvore com códigos pela posição, grupos com o código na descrição, e a seção III pela fonte", () => {
  const p = planilhasDoStr({ estado: cenario(), contas: CONTAS, prestacao: DADOS, fonte: "art1a" });
  assert.deepEqual(p.do.linhas.map(l => [l.tipo, l.codigo, l.descricao, l.aprovado, l.executado]), [
    ["grupo", "", "1 Produção", 9_500_000, 1_800_000],
    ["item", "1.1", "Câmera", 6_000_000, 1_000_000],
    ["item", "1.2", "Montagem", 3_500_000, 800_000],
    ["vazia", "", "", 0, 0],
    ["item", "2", "Gerenciamento", 500_000, 0],
  ]);
  assert.equal(p.do.mecanismo, "indireto");
  // Fonte na linha 22 (art. 1º-A), contrapartida mínima de 5% na 29, rendimentos na 30.
  assert.deepEqual(p.do.captacoes, [{ linha: 22, aprovado: 9_500_000, captado: 10_000_000 }, { linha: 29, aprovado: 500_000, captado: 500_000 }, { linha: 30, aprovado: 0, captado: 12_000 }]);
  assert.deepEqual([p.totais.aComprovar, p.totais.comprovado], [10_512_000, 1_801_250]);
});

test("críticas: CPF inválido e número não numérico na carga; a comprovar maior que o comprovado no envio; avisos à parte", () => {
  const p = planilhasDoStr({ estado: cenario(), contas: CONTAS, prestacao: DADOS, fonte: "art1a" });
  const rp = (campo: string) => p.criticas.filter(c => c.arquivo === "RP_21-0123_22222-2.xls" && c.campo === campo).map(c => [c.linha, c.momento]);
  assert.deepEqual(rp("II.c. CPF/CNPJ"), [[14, "carga"]]);
  assert.deepEqual(rp("II.g. Nº doc. fiscal"), [[14, "carga"]]);
  assert.ok(p.criticas.some(c => c.campo === "A comprovar × comprovado" && c.momento === "envio" && /faltam R\$\s87\.107,50/.test(c.mensagem)));
  // A despesa paga sem débito no extrato fica fora da RP, com aviso para conciliar; a recusada não aparece.
  assert.ok(p.criticas.some(c => c.momento === "aviso" && c.mensagem.startsWith('"sem_item.pdf": um pagamento não está ligado')));
  assert.ok(!p.criticas.some(c => c.mensagem.includes("recusada")));
  // O saldo da captação não fecha em zero: aviso, não crítica.
  assert.ok(p.criticas.some(c => c.arquivo === "DE_21-0123_11111-1.xls" && c.campo === "II.i. Saldo" && c.momento === "aviso"));
  assert.ok(criticasQueBloqueiam(p.criticas).every(c => c.momento !== "aviso"));

  // Sem SALIC no formato e sem fonte: críticas de carga.
  const sem = planilhasDoStr({ estado: cenario(), contas: CONTAS, prestacao: { ...DADOS, identificador: "2021/0123" }, fonte: null });
  assert.ok(sem.criticas.some(c => c.campo === "SALIC" && c.momento === "carga"));
  assert.ok(sem.criticas.some(c => c.campo === "I.d. Mecanismo" && c.momento === "carga"));
});

// ─── Gravação ───────────────────────────────────────────────────────────────

const ler = (dados: Uint8Array) => {
  const livro = XLSX.read(dados, { cellNF: true });
  return { nome: livro.SheetNames[0], aba: livro.Sheets[livro.SheetNames[0]] };
};
const v = (aba: XLSX.WorkSheet, endereco: string) => aba[endereco]?.v;

test("RP gravada sobre o modelo: cabeçalho, linhas, data como data e linhas inseridas antes do total", () => {
  const p = planilhasDoStr({ estado: cenario(), contas: CONTAS, prestacao: DADOS, fonte: "art1a" });
  const base = p.rps[0];
  const muitas = { ...base, linhas: Array.from({ length: 25 }, (_, i) => ({ ...base.linhas[0], valor: 100 * (i + 1) })), total: 100 * (25 * 26) / 2 };
  const { nome, aba } = ler(gravarRp(XLSX, modelo("Relacao_de_Pagamentos"), p.cabecalho, muitas));
  assert.equal(nome, "REL. PGTOS");
  assert.deepEqual([v(aba, "C5"), v(aba, "C6"), v(aba, "C7"), v(aba, "B8"), v(aba, "D8"), v(aba, "H8")], ["Filme Teste", "21-0123", "Produtora Teste Ltda", "001", "1234", "22222-2"]);
  assert.deepEqual([v(aba, "A12"), v(aba, "C12"), v(aba, "D12"), v(aba, "F12"), v(aba, "G12"), v(aba, "I12")], ["1.1", "11222333000181", "TED 62.501 LOCADORA", "NF", 123, 1]);
  assert.equal(XLSX.SSF.format("dd/mm/yyyy", v(aba, "E12")), "05/03/2026");
  // 25 linhas: 7 a mais que o modelo; o total desce da linha 30 para a 37, e as observações vão junto.
  assert.equal(v(aba, "I36"), 25);
  assert.equal(v(aba, "I37"), 325);
  assert.equal(v(aba, "A30"), "1.1");
  assert.match(String(v(aba, "A37")), /^II\.j\. TOTAL/);
  assert.match(String(v(aba, "A39")), /^III\. OBSERVAÇÕES/);
  assert.ok((aba["!merges"] ?? []).some(m => m.s.r === 39 && m.s.c === 0), "a mesclagem das observações acompanha");
});

test("DE e DO gravados sobre o modelo", () => {
  const p = planilhasDoStr({ estado: cenario(), contas: CONTAS, prestacao: DADOS, fonte: "art1a" });
  const de = ler(gravarDe(XLSX, modelo("Demonstrativo_do_Extrato"), p.cabecalho, p.des[1])).aba;
  assert.deepEqual([v(de, "B10"), v(de, "D10"), v(de, "B14"), v(de, "E14"), v(de, "G15"), v(de, "H16"), v(de, "I17")], ["MOVIMENTAÇÃO", "001", "TRANSF CAPTACAO", 95_000, 10_000, 12.5, 81_987.5]);
  assert.equal(v(de, "G20"), 13_000);
  assert.equal(v(de, "H29"), 81_987.5);

  const doAba = ler(gravarDo(XLSX, modelo("Demonstrativo_Orcamentario_e_Financeiro"), p.cabecalho, p.do)).aba;
  assert.equal(v(doAba, "C9"), "Fomento Indireto (leis de incentivo)");
  assert.deepEqual([v(doAba, "C22"), v(doAba, "D22"), v(doAba, "D29"), v(doAba, "D30"), v(doAba, "D31")], [95_000, 100_000, 5_000, 120, 105_120]);
  assert.deepEqual([v(doAba, "A52"), v(doAba, "B52"), v(doAba, "A53"), v(doAba, "B53"), v(doAba, "C53"), v(doAba, "D53")], [undefined, "1 Produção", "1.1", "Câmera", 60_000, 10_000]);
  assert.equal(v(doAba, "A56"), "2");
  // O exemplo do modelo some: "8.1 Gerenciamento" da linha 441 não fica.
  assert.equal(v(doAba, "A441"), undefined);
  assert.deepEqual([v(doAba, "C447"), v(doAba, "D447"), v(doAba, "C12"), v(doAba, "C13")], [100_000, 18_000, 105_120, 18_000]);
});
