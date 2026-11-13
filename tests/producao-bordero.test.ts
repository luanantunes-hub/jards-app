import assert from "node:assert/strict";
import test from "node:test";
import {
  calcularBordero, emCentavos, formatarReais, lerDeducao, lerReceita, lerValorEmReais, mensagemDoErroDeBordero, MODELOS_DE_DEDUCAO, pendenciasParaFechar, publicoDoBordero, textoDoBordero,
  type DeducaoDoBordero, type ReceitaDoBordero,
} from "../lib/producao/bordero";

const receitas: ReceitaDoBordero[] = [{ id: "r1", categoria: "Meia", quantidade: 40, valor_unitario: 25 }, { id: "r2", categoria: "Inteira", quantidade: 80, valor_unitario: 50 }];
const deducoes: DeducaoDoBordero[] = [
  { id: "d2", nome: "Taxa da casa", forma: "fixo", valor: 300, beneficiario: "Casa", ordem: 2 },
  { id: "d1", nome: "ISS", forma: "percentual", valor: 5, beneficiario: "Prefeitura", ordem: 1 },
];

test("contas: bruto, porcentagem sobre o bruto, fixo, líquido e ticket médio (tudo em centavos)", () => {
  const contas = calcularBordero(receitas, deducoes);
  assert.equal(contas.ingressos, 120);
  assert.equal(contas.brutoCentavos, 500000, "80 × 50 + 40 × 25 = R$ 5.000,00");
  assert.deepEqual(contas.receitas.map(l => l.categoria), ["Inteira", "Meia"], "ordem alfabética");
  assert.deepEqual(contas.deducoes.map(l => [l.nome, l.descontoCentavos]), [["ISS", 25000], ["Taxa da casa", 30000]], "ISS 5% de 5.000 = 250; fixo 300; na ordem informada");
  assert.equal(contas.totalDeducoesCentavos, 55000);
  assert.equal(contas.liquidoCentavos, 445000);
  assert.equal(contas.ticketMedioCentavos, Math.round(500000 / 120));
});

test("contas: arredonda ao centavo, aceita líquido negativo e vazio", () => {
  const um = calcularBordero([{ id: "r", categoria: "Inteira", quantidade: 3, valor_unitario: 33.33 }], [{ id: "d", nome: "Taxa", forma: "percentual", valor: 2.5, beneficiario: null, ordem: 0 }]);
  assert.equal(um.brutoCentavos, 9999);
  assert.equal(um.deducoes[0].descontoCentavos, 250, "2,5% de 99,99 = 2,49975 → R$ 2,50");
  const negativo = calcularBordero([{ id: "r", categoria: "Inteira", quantidade: 1, valor_unitario: 10 }], [{ id: "d", nome: "Fixa", forma: "fixo", valor: 30, beneficiario: null, ordem: 0 }]);
  assert.equal(negativo.liquidoCentavos, -2000);
  const vazio = calcularBordero([], []);
  assert.deepEqual([vazio.ingressos, vazio.brutoCentavos, vazio.liquidoCentavos, vazio.ticketMedioCentavos], [0, 0, 0, null]);
  assert.equal(emCentavos(19.9), 1990, "sem erro de ponto flutuante");
});

test("reais: formato brasileiro", () => {
  assert.equal(formatarReais(123456), "R$ 1.234,56");
  assert.equal(formatarReais(0), "R$ 0,00");
  assert.equal(formatarReais(-2000), "-R$ 20,00");
});

test("público: o da casa vale; o da porta aparece e avisa quando diverge", () => {
  assert.deepEqual(publicoDoBordero(null, 0), { casa: null, porta: 0, oficial: null, origem: "nenhuma", aviso: null });
  const soPorta = publicoDoBordero(null, 80);
  assert.deepEqual([soPorta.oficial, soPorta.origem], [80, "porta"]);
  assert.match(soPorta.aviso ?? "", /só conta quem tem credencial/);
  assert.equal(publicoDoBordero(120, 118).aviso, null, "diferença pequena não avisa");
  assert.equal(publicoDoBordero(120, 0).aviso, null, "sem leitura da porta não há o que comparar");
  assert.match(publicoDoBordero(120, 100).aviso ?? "", /20 pessoas entraram sem credencial/);
  assert.match(publicoDoBordero(100, 130).aviso ?? "", /deveria ter pelo menos o que entrou pela porta/);
  assert.equal(publicoDoBordero(100, 130).oficial, 100);
  assert.equal(publicoDoBordero(1000, 960).aviso, null, "40 de 1000 está abaixo de 5%");
  assert.match(publicoDoBordero(1000, 940).aviso ?? "", /60 pessoas/);
});

test("pendências antes de fechar", () => {
  assert.deepEqual(pendenciasParaFechar({ publicoCasa: null, porta: 0, receitas: 0, liquidoCentavos: 0 }), ["Falta o público", "Nenhuma receita lançada"]);
  assert.deepEqual(pendenciasParaFechar({ publicoCasa: 100, porta: 0, receitas: 2, liquidoCentavos: 100 }), []);
  assert.deepEqual(pendenciasParaFechar({ publicoCasa: null, porta: 50, receitas: 1, liquidoCentavos: -1 }), ["O líquido está negativo: as deduções passam da receita"]);
});

test("valor em reais: formas que a pessoa digita", () => {
  assert.equal(lerValorEmReais("50"), 50);
  assert.equal(lerValorEmReais("50,5"), 50.5);
  assert.equal(lerValorEmReais("1.234,56"), 1234.56);
  assert.equal(lerValorEmReais("1234.56"), 1234.56);
  assert.equal(lerValorEmReais("R$ 25,00"), 25);
  assert.equal(lerValorEmReais("1.234"), 1234, "ponto com três dígitos depois é milhar");
  assert.equal(lerValorEmReais(""), null);
  assert.equal(lerValorEmReais("abc"), null);
  assert.equal(lerValorEmReais("-5"), null);
  assert.equal(lerValorEmReais("1,234"), null, "três casas decimais não vale");
});

test("receita: categoria, quantidade e valor", () => {
  assert.deepEqual(lerReceita({ categoria: " Inteira ", quantidade: "80", valor: "50,00" }), { ok: true, valor: { categoria: "Inteira", quantidade: 80, valor_unitario: 50 } });
  assert.deepEqual(lerReceita({ categoria: "Cortesia", quantidade: "", valor: "" }), { ok: true, valor: { categoria: "Cortesia", quantidade: 0, valor_unitario: 0 } });
  const campo = (extra: Partial<{ categoria: string; quantidade: string; valor: string }>) => { const l = lerReceita({ categoria: "x", quantidade: "1", valor: "1", ...extra }); return l.ok ? null : l.campo; };
  assert.equal(campo({ categoria: " " }), "categoria");
  assert.equal(campo({ categoria: "x".repeat(61) }), "categoria");
  assert.equal(campo({ quantidade: "-1" }), "quantidade");
  assert.equal(campo({ quantidade: "1000001" }), "quantidade");
  assert.equal(campo({ valor: "abc" }), "valor");
  assert.equal(campo({ valor: "10000001" }), "valor");
});

test("dedução: nome, forma, valor, quem recebe, ordem", () => {
  assert.deepEqual(lerDeducao({ nome: " ISS ", forma: "percentual", valor: "5", beneficiario: " ", ordem: "" }), { ok: true, valor: { nome: "ISS", forma: "percentual", valor: 5, beneficiario: null, ordem: 0 } });
  assert.deepEqual(lerDeducao({ nome: "Taxa", forma: "fixo", valor: "1.250,50", beneficiario: "Casa", ordem: "2" }), { ok: true, valor: { nome: "Taxa", forma: "fixo", valor: 1250.5, beneficiario: "Casa", ordem: 2 } });
  const campo = (extra: Partial<{ nome: string; forma: "percentual" | "fixo"; valor: string; beneficiario: string; ordem: string }>) => { const l = lerDeducao({ nome: "x", forma: "percentual", valor: "5", beneficiario: "", ordem: "", ...extra }); return l.ok ? null : l.campo; };
  assert.equal(campo({ nome: "" }), "nome");
  assert.equal(campo({ valor: "" }), "valor");
  assert.equal(campo({ valor: "101" }), "valor");
  assert.equal(campo({ forma: "fixo", valor: "101" }), null, "fixo pode passar de 100");
  assert.equal(campo({ beneficiario: "x".repeat(81) }), "beneficiario");
  assert.equal(campo({ ordem: "1000" }), "ordem");
});

test("modelos de dedução não trazem alíquota", () => {
  assert.ok(MODELOS_DE_DEDUCAO.length >= 4);
  for (const modelo of MODELOS_DE_DEDUCAO) assert.deepEqual(Object.keys(modelo).sort(), ["forma", "nome"]);
});

test("texto do borderô: completo com dinheiro; só o público sem", () => {
  const contas = calcularBordero(receitas, deducoes);
  const publico = publicoDoBordero(120, 100);
  const completo = textoDoBordero({ sessao: "Peça, 05/12", situacao: "conferido", publico, contas, comDinheiro: true });
  assert.match(completo, /^Borderô: Peça, 05\/12 \(conferido\)\nPúblico: 120 · porta registrou 100\n/);
  assert.match(completo, /Inteira: 80 × R\$ 50,00 = R\$ 4\.000,00/);
  assert.match(completo, /Receita bruta: R\$ 5\.000,00/);
  assert.match(completo, /\(-\) ISS \(5%\) → Prefeitura: R\$ 250,00/);
  assert.match(completo, /Líquido: R\$ 4\.450,00$/);
  const semDinheiro = textoDoBordero({ sessao: "Peça, 05/12", situacao: "rascunho", publico, contas, comDinheiro: false });
  assert.doesNotMatch(semDinheiro, /R\$/);
  assert.match(semDinheiro, /Público: 120/);
});

test("erros do banco viram frases claras", () => {
  assert.match(mensagemDoErroDeBordero({ message: "bordero_fechado" }), /fechado/);
  assert.match(mensagemDoErroDeBordero({ code: "42501" }), /permissão de dinheiro/);
  assert.match(mensagemDoErroDeBordero({ code: "23505", message: "producao_bordero_receitas_categoria_idx" }), /categoria/);
  assert.match(mensagemDoErroDeBordero({ code: "23505", message: "producao_borderos_sessao_key" }), /já tem borderô/);
  assert.match(mensagemDoErroDeBordero({}), /Tente de novo/);
});
