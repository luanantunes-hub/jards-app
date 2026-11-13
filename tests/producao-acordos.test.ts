import assert from "node:assert/strict";
import test from "node:test";
import { lerValorEmReais } from "../lib/producao/bordero";
import {
  acordoTravado, comprometidoDoAcordoEmCentavos, lerAcordo, mensagemDoErroDeAcordo, proximaSituacaoDoAcordo, resumoDasCondicoes, situacaoAnteriorDoAcordo, textoDoAcordo,
  valorFirmeDoAcordoEmCentavos, type AcordoDaTemporada,
} from "../lib/producao/acordos";
import { calcularOrcamento } from "../lib/producao/orcamento";

const acordo = (extra: Partial<AcordoDaTemporada> = {}): AcordoDaTemporada => ({
  id: "a", contraparte: "Teatro Central", tipo: "cache", sentido: "a_pagar", situacao: "rascunho", valor_fixo: null, garantia: null, percentual_bilheteria: null,
  bonus_publico: null, bonus_valor: null, despesas_nossas: null, despesas_da_contraparte: null, retencoes: null, observacao: null, assinado_em: null, ...extra,
});

test("acordo: a situação anda um passo; volta só até a assinatura; assinado só vai para encerrado", () => {
  assert.equal(proximaSituacaoDoAcordo("rascunho"), "revisao");
  assert.equal(proximaSituacaoDoAcordo("para_assinatura"), "assinado");
  assert.equal(proximaSituacaoDoAcordo("assinado"), "encerrado");
  assert.equal(proximaSituacaoDoAcordo("encerrado"), null);
  assert.equal(situacaoAnteriorDoAcordo("rascunho"), null);
  assert.equal(situacaoAnteriorDoAcordo("revisao"), "rascunho");
  assert.equal(situacaoAnteriorDoAcordo("para_assinatura"), "revisao");
  assert.equal(situacaoAnteriorDoAcordo("assinado"), null);
  assert.deepEqual(["rascunho", "revisao", "para_assinatura", "assinado", "encerrado"].map(s => acordoTravado(s as never)), [false, false, false, true, true]);
});

test("acordo: o valor firme é o maior entre o fixo e a garantia, e só um acordo a pagar assinado compromete", () => {
  assert.equal(valorFirmeDoAcordoEmCentavos({ valor_fixo: 8000, garantia: null }), 800000);
  assert.equal(valorFirmeDoAcordoEmCentavos({ valor_fixo: 8000, garantia: 10000.5 }), 1000050);
  assert.equal(valorFirmeDoAcordoEmCentavos({ valor_fixo: null, garantia: null }), 0);
  assert.equal(comprometidoDoAcordoEmCentavos(acordo({ valor_fixo: 8000, situacao: "assinado" })), 800000);
  assert.equal(comprometidoDoAcordoEmCentavos(acordo({ valor_fixo: 8000, situacao: "encerrado" })), 800000);
  assert.equal(comprometidoDoAcordoEmCentavos(acordo({ valor_fixo: 8000, situacao: "para_assinatura" })), null, "ainda não assinou");
  assert.equal(comprometidoDoAcordoEmCentavos(acordo({ valor_fixo: 8000, situacao: "assinado", sentido: "a_receber" })), null, "a receber não compromete gasto");
});

test("acordo: as condições numa frase", () => {
  assert.equal(resumoDasCondicoes(acordo()), "Sem condições de valor");
  assert.match(resumoDasCondicoes(acordo({ valor_fixo: 8000, garantia: 10000, percentual_bilheteria: 20, bonus_publico: 300, bonus_valor: 500 })),
    /R\$\s?8\.000,00 fixo · garantia R\$\s?10\.000,00 · 20% da bilheteria · bônus de R\$\s?500,00 a partir de 300 pessoas/);
});

const campos = { contraparte: " Teatro Central ", tipo: "misto" as const, sentido: "a_pagar" as const, valorFixo: "8.000", garantia: "", percentual: "12,5", bonusPublico: "", bonusValor: "", despesasNossas: "", despesasDaContraparte: " Som e luz ", retencoes: "", observacao: "" };

test("acordo: leitura do que a pessoa digita", () => {
  assert.deepEqual(lerAcordo(campos, lerValorEmReais), {
    ok: true,
    valor: { contraparte: "Teatro Central", tipo: "misto", sentido: "a_pagar", valor_fixo: 8000, garantia: null, percentual_bilheteria: 12.5, bonus_publico: null, bonus_valor: null,
      despesas_nossas: null, despesas_da_contraparte: "Som e luz", retencoes: null, observacao: null },
  });
  const erro = (extra: Partial<typeof campos>) => { const r = lerAcordo({ ...campos, ...extra }, lerValorEmReais); return r.ok ? "ok" : r.campo; };
  assert.equal(erro({ contraparte: " " }), "contraparte");
  assert.equal(erro({ contraparte: "x".repeat(121) }), "contraparte");
  assert.equal(erro({ valorFixo: "abc" }), "valorFixo");
  assert.equal(erro({ garantia: "-1" }), "garantia");
  assert.equal(erro({ percentual: "101" }), "percentual");
  assert.equal(erro({ bonusPublico: "300" }), "bonusValor", "bônus pede os dois");
  assert.equal(erro({ bonusValor: "500" }), "bonusPublico", "bônus pede os dois");
  assert.equal(erro({ bonusPublico: "0", bonusValor: "500" }), "bonusPublico");
  assert.equal(erro({ bonusPublico: "300", bonusValor: "500" }), "ok");
  assert.equal(erro({ retencoes: "x".repeat(401) }), "retencoes");
  assert.equal(erro({ observacao: "x".repeat(501) }), "observacao");
});

test("acordo: texto para colar", () => {
  const texto = textoDoAcordo(acordo({ valor_fixo: 8000, percentual_bilheteria: 20, situacao: "assinado", assinado_em: "2027-02-10", despesas_da_contraparte: "Som e luz", retencoes: "ISS" }), ["01/03", "02/03"]);
  assert.match(texto, /Acordo: Teatro Central \(cachê, a pagar\) — assinado/);
  assert.match(texto, /Condições: R\$\s?8\.000,00 fixo · 20% da bilheteria/);
  assert.match(texto, /Datas cobertas: 01\/03, 02\/03/);
  assert.match(texto, /Despesas por conta de Teatro Central: Som e luz/);
  assert.match(texto, /Retenções: ISS/);
  assert.match(texto, /Assinado em 10\/02\/2027/);
});

test("acordo: mensagens do banco viram texto claro", () => {
  assert.match(mensagemDoErroDeAcordo({ message: "acordo_encerrado" }), /encerrado/);
  assert.match(mensagemDoErroDeAcordo({ message: "acordo_assinado" }), /assinado/);
  assert.match(mensagemDoErroDeAcordo({ message: "acordo_situacao_invalida" }), /um passo/);
  assert.match(mensagemDoErroDeAcordo({ message: "data_de_outra_temporada" }), /não é desta temporada/);
  assert.match(mensagemDoErroDeAcordo({ code: "42501" }), /permissão de dinheiro/);
  assert.match(mensagemDoErroDeAcordo({ code: "23505" }), /já está/);
  assert.match(mensagemDoErroDeAcordo({}), /Não foi possível salvar/);
});

test("orçamento: o comprometido de um acordo assinado vale no lugar do digitado", () => {
  const linhas = [
    { id: "a", categoria: "cache" as const, descricao: "Cachê", estimativa: 8000, aprovado: null, revisado: null, comprometido: 100, pago: 0, ordem: 0, acordo_id: "x" },
    { id: "b", categoria: "hospedagem" as const, descricao: "Hotel", estimativa: 500, aprovado: null, revisado: null, comprometido: 200, pago: 0, ordem: 0 },
  ];
  const contas = calcularOrcamento(linhas, { a: 800000 });
  assert.equal(contas.linhas[0].comprometidoCentavos, 800000);
  assert.equal(contas.linhas[0].viaAcordo, true);
  assert.equal(contas.linhas[1].comprometidoCentavos, 20000, "sem acordo, vale o digitado");
  assert.equal(contas.linhas[1].viaAcordo, false);
  assert.equal(contas.comprometidoCentavos, 820000);
  assert.equal(calcularOrcamento(linhas).comprometidoCentavos, 30000, "sem o mapa, nada muda");
});
