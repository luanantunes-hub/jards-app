import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TelaDados, TelaEscolherIngressos } from "../components/ticketeria/CompraView";
import { CupomSheet, CuponsDaLoja } from "../components/ticketeria/CuponsView";
import {
  codigoDoCupomValido, descontoDoIngresso, descontoEmTexto, descontoNasFaixas, lerCupom, lerCupomConferido, mensagemDoErroDeGravarCupom, mensagemDoErroDoCupom, normalizarCodigo, situacaoDoCupom, validadeEmTexto, validadeParaCampo, valorParaCampo,
} from "../lib/ticketeria/cupom";
import { ErroDaCompra, iniciarCompra, lerCorpoDaCompra, type PortasDaCompra } from "../lib/ticketeria/pagamento/compra";
import { mensagemDoErroDaReserva } from "../lib/ticketeria/pagamento/reserva";
import { VERSAO_DOS_TERMOS_DE_COMPRA } from "../lib/ticketeria/termos-de-compra";

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el).replace(/\u00a0/g, " ");
const SESSAO = "0d770000-0000-4000-8000-000000000081";
const INGRESSO = "0d770000-0000-4000-8000-000000000031";
const bom = { sessao_id: SESSAO, itens: [{ ingresso_id: INGRESSO, quantidade: 1 }], nome: "Rita Teste", email: "rita@teste.com", documento: "529.982.247-25", termos: VERSAO_DOS_TERMOS_DE_COMPRA };

test("o desconto de um ingresso: os mesmos casos do banco (fn_ticketeria_desconto_do_ingresso)", () => {
  assert.equal(descontoDoIngresso(6000, "percentual", 20), 1200);
  assert.equal(descontoDoIngresso(6000, "percentual", 100), 6000);
  assert.equal(descontoDoIngresso(6000, "valor", 1000), 1000);
  assert.equal(descontoDoIngresso(6000, "valor", 999999), 6000, "valor fixo nunca passa do preço");
  assert.equal(descontoDoIngresso(0, "percentual", 50), 0, "ingresso grátis não recebe desconto");
  assert.equal(descontoDoIngresso(0, "valor", 500), 0);
  assert.equal(descontoDoIngresso(5, "percentual", 50), 3, "arredonda como o banco: meio centavo sobe");
  assert.equal(descontoDoIngresso(1234, "percentual", 15), 185);
});

test("o desconto nas faixas de preço: tira dos lotes em ordem, como o banco", () => {
  const faixas = [{ preco_centavos: 5000, livres: 2 }, { preco_centavos: 8000, livres: 3 }];
  const cupom = { tipo: "percentual" as const, valor: 10, ingresso_id: null };
  assert.equal(descontoNasFaixas(faixas, 1, cupom, INGRESSO), 500);
  assert.equal(descontoNasFaixas(faixas, 3, cupom, INGRESSO), 500 + 500 + 800, "o terceiro ingresso já é do segundo lote");
  assert.equal(descontoNasFaixas(faixas, 6, cupom, INGRESSO), 0, "não há tantos ingressos: sem conta");
  assert.equal(descontoNasFaixas(faixas, 0, cupom, INGRESSO), 0);
  assert.equal(descontoNasFaixas(faixas, 2, { tipo: "valor", valor: 6000, ingresso_id: INGRESSO }, INGRESSO), 10000, "valor maior que o preço: desconta o preço");
  assert.equal(descontoNasFaixas(faixas, 2, { tipo: "valor", valor: 100, ingresso_id: "outro" }, INGRESSO), 0, "cupom de outro ingresso não vale aqui");
});

test("o código: maiúsculas, sem espaços nas pontas, de 3 a 20 letras e números", () => {
  assert.equal(normalizarCodigo("  amigos20 "), "AMIGOS20");
  assert.equal(normalizarCodigo(null), "");
  for (const bom of ["ABC", "AMIGOS20", "A".repeat(20)]) assert.equal(codigoDoCupomValido(bom), true, bom);
  for (const ruim of ["AB", "A".repeat(21), "A B", "AMIGOS-20", "AMIGÃO", ""]) assert.equal(codigoDoCupomValido(ruim), false, ruim);
});

test("o corpo da compra aceita o cupom: normalizado, ou nulo quando vazio, ou recusado se o formato é ruim", () => {
  const ok = (extra: object) => { const r = lerCorpoDaCompra({ ...bom, ...extra }); assert.ok(r.ok); return r.ok ? r.corpo.cupom : "x"; };
  assert.equal(ok({}), null);
  assert.equal(ok({ cupom: "" }), null);
  assert.equal(ok({ cupom: null }), null);
  assert.equal(ok({ cupom: "  amigos20 " }), "AMIGOS20");
  for (const ruim of ["a b", "x", 12, "A".repeat(30)]) {
    const r = lerCorpoDaCompra({ ...bom, cupom: ruim });
    assert.deepEqual(r, { ok: false, problemas: ["cupom"] }, String(ruim));
  }
});

test("a compra manda o código do cupom para a reserva", async () => {
  const vistos: unknown[] = [];
  const portas: PortasDaCompra = {
    async contaDaSessao() { return { chave: "chave-da-subconta-0123456789", aprovada: true }; },
    async reservar(corpo) { vistos.push(corpo.cupom); return { pedido_id: "0d770000-0000-4000-8000-0000000000e1", codigo: "ABCD2345", situacao: "pago", reservado_ate: "2026-11-19T12:15:00.000Z", total_centavos: 0, taxa_centavos: 0, produtor_centavos: 0 }; },
    async registrarAceite() {},
    async definirMeio() {},
    provedor() { throw new Error("pedido de valor zero não abre cobrança"); },
    carteiraDoJards: "carteira",
  };
  const l = lerCorpoDaCompra({ ...bom, cupom: "gratis" });
  assert.ok(l.ok);
  if (!l.ok) return;
  const r = await iniciarCompra(l.corpo, portas);
  assert.deepEqual(vistos, ["GRATIS"]);
  assert.equal(r.situacao, "pago", "cupom de 100%: o pedido nasce pago, sem cobrança");
  // O erro do cupom chega ao comprador como a frase dele.
  const recusada: PortasDaCompra = { ...portas, async reservar() { throw new ErroDaCompra("reserva_recusada", mensagemDoErroDaReserva({ message: "cupom_vencido" })); } };
  await assert.rejects(() => iniciarCompra(l.corpo, recusada), (erro: unknown) => erro instanceof ErroDaCompra && erro.mensagem === "Esse cupom venceu.");
});

test("os erros do cupom viram frases; a reserva sabe traduzi-las antes do 'esgotado' dos lugares", () => {
  assert.equal(mensagemDoErroDoCupom("cupom_invalido"), "Esse cupom não existe ou não está mais valendo.");
  assert.equal(mensagemDoErroDoCupom("cupom_vencido"), "Esse cupom venceu.");
  assert.equal(mensagemDoErroDoCupom("cupom_esgotado"), "Esse cupom já foi usado todas as vezes.");
  assert.equal(mensagemDoErroDoCupom("cupom_nao_vale"), "Esse cupom não vale para os ingressos escolhidos.");
  assert.equal(mensagemDoErroDoCupom("esgotado"), null);
  assert.equal(mensagemDoErroDaReserva({ message: "cupom_esgotado" }), "Esse cupom já foi usado todas as vezes.", "não confunde com lugares esgotados");
  assert.match(mensagemDoErroDaReserva({ message: "esgotado" }), /lugares/);
});

test("a resposta do banco ao conferir o cupom é lida com cuidado", () => {
  assert.deepEqual(lerCupomConferido({ codigo: "AMIGOS20", tipo: "percentual", valor: 20, ingresso_id: null, evento_id: "x" }), { codigo: "AMIGOS20", tipo: "percentual", valor: 20, ingresso_id: null });
  assert.deepEqual(lerCupomConferido({ codigo: "DEZ", tipo: "valor", valor: 1000, ingresso_id: INGRESSO }), { codigo: "DEZ", tipo: "valor", valor: 1000, ingresso_id: INGRESSO });
  for (const ruim of [null, {}, { codigo: "X", tipo: "outro", valor: 1 }, { codigo: "X", tipo: "valor", valor: 0 }, { codigo: "X", tipo: "valor", valor: 1.5 }, { codigo: "X", tipo: "valor", valor: 5, ingresso_id: 7 }]) assert.equal(lerCupomConferido(ruim), null);
});

test("o formulário do produtor: porcentagem, valor em reais, limite e validade", () => {
  const base = { codigo: " amigos20 ", tipo: "percentual" as const, valor: "20", limite: "", ate: "" };
  assert.deepEqual(lerCupom(base), { ok: true, valor: { codigo: "AMIGOS20", tipo: "percentual", valor: 20, limite_usos: null, valido_ate: null } });
  assert.deepEqual(lerCupom({ ...base, valor: "20%" }), { ok: true, valor: { codigo: "AMIGOS20", tipo: "percentual", valor: 20, limite_usos: null, valido_ate: null } });
  const valor = lerCupom({ ...base, tipo: "valor", valor: "7,50", limite: "1.000", ate: "2026-12-31" });
  assert.ok(valor.ok);
  if (valor.ok) {
    assert.equal(valor.valor.valor, 750);
    assert.equal(valor.valor.limite_usos, 1000);
    assert.equal(validadeParaCampo(valor.valor.valido_ate), "2026-12-31", "vale até o fim do dia escolhido, no horário de Brasília");
    assert.equal(validadeEmTexto(valor.valor.valido_ate), "31/12/2026");
  }
  for (const [mudanca, trecho] of [
    [{ codigo: "A" }, "3 a 20"], [{ codigo: "A B" }, "3 a 20"], [{ valor: "0" }, "porcentagem"], [{ valor: "101" }, "porcentagem"], [{ valor: "abc" }, "porcentagem"],
    [{ tipo: "valor" as const, valor: "0" }, "em reais"], [{ tipo: "valor" as const, valor: "" }, "em reais"], [{ tipo: "valor" as const, valor: "200000" }, "100.000"],
    [{ limite: "0" }, "limite"], [{ limite: "x" }, "limite"], [{ ate: "2026-02-31" }, "não existe"],
  ] as [object, string][]) {
    const r = lerCupom({ ...base, ...mudanca });
    assert.ok(!r.ok && new RegExp(trecho, "i").test(r.erro), `${JSON.stringify(mudanca)}: ${JSON.stringify(r)}`);
  }
  assert.equal(valorParaCampo("percentual", 20), "20");
  assert.equal(valorParaCampo("valor", 750), "7,50");
});

test("a situação do cupom: desativado, vencido, esgotado ou ativo", () => {
  const agora = Date.parse("2026-11-19T12:00:00Z");
  const base = { ativo: true, valido_ate: null, limite_usos: null, usos: 0 };
  assert.equal(situacaoDoCupom(base, agora), "ativo");
  assert.equal(situacaoDoCupom({ ...base, ativo: false }, agora), "desativado");
  assert.equal(situacaoDoCupom({ ...base, valido_ate: "2026-11-19T11:00:00Z" }, agora), "vencido");
  assert.equal(situacaoDoCupom({ ...base, valido_ate: "2026-11-20T11:00:00Z" }, agora), "ativo");
  assert.equal(situacaoDoCupom({ ...base, limite_usos: 5, usos: 5 }, agora), "esgotado");
  assert.equal(situacaoDoCupom({ ...base, limite_usos: 5, usos: 4 }, agora), "ativo");
  assert.equal(situacaoDoCupom({ ...base, ativo: false, limite_usos: 1, usos: 1 }, agora), "desativado", "desativado vem primeiro");
  assert.equal(descontoEmTexto("percentual", 20), "20% de desconto");
  assert.equal(descontoEmTexto("valor", 1000), "R$ 10,00 de desconto por ingresso");
});

test("o erro ao gravar um cupom vira uma frase", () => {
  assert.match(mensagemDoErroDeGravarCupom({ code: "23505", message: "duplicate key" }), /Já existe um cupom com esse código/);
  assert.match(mensagemDoErroDeGravarCupom({ code: "42501" }), /Você não pode/);
  assert.match(mensagemDoErroDeGravarCupom({ message: "cupom_ingresso_de_outro_evento" }), /não é deste evento/);
  assert.match(mensagemDoErroDeGravarCupom({ message: "?" }), /Não foi possível salvar/);
});

const evento = { titulo: "Hamlet", quando: "sáb., 29 nov. · 20h", local: "Teatro" };
const ingressos = [{ id: INGRESSO, nome: "Inteira", descricao: null, limite: 10, faixas: [{ preco_centavos: 6000, livres: 20 }] }];

test("a página de compra: sem cupom oferece 'Tem um cupom?'; com cupom mostra o código, o desconto e o total", () => {
  const props = { site: { titulo: "Cia Teste" }, evento, ingressos, quantidades: { [INGRESSO]: 1 } };
  const fechado = html(createElement(TelaEscolherIngressos, props));
  assert.ok(fechado.includes("Tem um cupom?"));
  assert.ok(!fechado.includes("Remover"));
  const campo = html(createElement(TelaEscolherIngressos, { ...props, cupomAberto: true, codigoDoCupom: "ami" }));
  assert.ok(campo.includes("Código do cupom") && campo.includes("Aplicar") && !campo.includes("Tem um cupom?"));
  const comErro = html(createElement(TelaEscolherIngressos, { ...props, cupomAberto: true, codigoDoCupom: "xyz", cupomErro: "Esse cupom venceu." }));
  assert.ok(comErro.includes('role="alert"') && comErro.includes("Esse cupom venceu."));
  const aplicado = html(createElement(TelaEscolherIngressos, { ...props, cupom: { codigo: "AMIGOS20", descricao: "20% de desconto", desconto_centavos: 1200 } }));
  for (const t of ["AMIGOS20", "20% de desconto", "Remover", "R$ 48,00"]) assert.ok(aplicado.includes(t), `falta: ${t}`);
  assert.ok(/−R\$ 12,00/.test(aplicado), "o desconto aparece no rodapé");
});

test("o resumo dos dados mostra o cupom entre os ingressos e o total", () => {
  const props = { site: { titulo: "Cia Teste" }, evento, valores: { nome: "", email: "", documento: "" }, erro: null, trabalhando: false };
  const com = html(createElement(TelaDados, { ...props, resumo: { linhas: [{ nome: "Inteira", quantidade: 1, total_centavos: 6000 }], total_centavos: 4800, desconto: { codigo: "AMIGOS20", centavos: 1200 } } }));
  assert.ok(com.includes("Cupom AMIGOS20") && /−R\$ 12,00/.test(com) && com.includes("R$ 48,00"));
  const sem = html(createElement(TelaDados, { ...props, resumo: { linhas: [{ nome: "Inteira", quantidade: 1, total_centavos: 6000 }], total_centavos: 6000 } }));
  assert.ok(!sem.includes("Cupom "));
});

test("a tela do produtor: a lista, o vazio e a folha", () => {
  const vazio = html(createElement(CuponsDaLoja, { cupons: [] }));
  assert.ok(vazio.includes("Nenhum cupom ainda"));
  const lista = html(createElement(CuponsDaLoja, { cupons: [
    { id: "1", codigo: "AMIGOS20", desconto: "20% de desconto", alcance: "Hamlet · todos os ingressos", usos: 3, limite: 50, validade: "31/12/2026", situacao: "ativo" },
    { id: "2", codigo: "VELHO", desconto: "R$ 10,00 de desconto por ingresso", alcance: "Hamlet · Inteira", usos: 1, limite: null, validade: null, situacao: "vencido" },
  ] }));
  for (const t of ["AMIGOS20", "20% de desconto", "3", "de 50", "31/12/2026", "ATIVO", "VENCIDO", "Sem prazo"]) assert.ok(lista.includes(t), `falta: ${t}`);
  const valores = { codigo: "", tipo: "percentual" as const, valor: "", evento: "e1", ingresso: "", limite: "", ate: "", ativo: true };
  const folha = (editando: boolean, v = valores) => html(createElement(CupomSheet, { editando, valores: v, eventos: [{ value: "e1", label: "Hamlet" }], ingressos: [], onClose: () => {}, onDesativar: () => {} }));
  assert.ok(folha(false).includes("Novo cupom") && folha(false).includes("Criar cupom") && !folha(false).includes("Desativar"));
  const edicao = folha(true, { ...valores, codigo: "AMIGOS20", valor: "20" });
  assert.ok(edicao.includes("Editar cupom") && edicao.includes("Desativar"));
  assert.ok(folha(true, { ...valores, codigo: "AMIGOS20", valor: "20", ativo: false }).includes("Reativar"));
});
