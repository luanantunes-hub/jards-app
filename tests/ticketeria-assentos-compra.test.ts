import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TelaEscolherLugares } from "../components/ticketeria/AssentosView";
import { TelaEscolherIngressos } from "../components/ticketeria/CompraView";
import { alternarEscolha, comCorredor, comEscolhidos, lerMapaDaSessao, mensagemDoErroDoMapa, rotuloDoLugar } from "../lib/ticketeria/mapa";
import { emailDosIngressos, type IngressosDoPedido } from "../lib/ticketeria/pagamento/ingressos";
import { ErroDaCompra, iniciarCompra, lerCorpoDaCompra, type PortasDaCompra } from "../lib/ticketeria/pagamento/compra";
import { mensagemDoErroDaReserva } from "../lib/ticketeria/pagamento/reserva";
import { VERSAO_DOS_TERMOS_DE_COMPRA } from "../lib/ticketeria/termos-de-compra";
import { limitarFaixas } from "../lib/ticketeria/vitrine";

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el).replace(/ /g, " ");
const SESSAO = "0d7a0000-0000-4000-8000-000000000081";
const A = "0d7a0000-0000-4000-8000-000000000031";
const B = "0d7a0000-0000-4000-8000-000000000032";
const bom = { sessao_id: SESSAO, itens: [{ ingresso_id: A, quantidade: 2 }], nome: "Rita Teste", email: "rita@teste.com", documento: "529.982.247-25", termos: VERSAO_DOS_TERMOS_DE_COMPRA };

test("o corpo da compra com lugares: normalizado, ou vazio quando não há, ou recusado", () => {
  const ok = (extra: object) => { const r = lerCorpoDaCompra({ ...bom, ...extra }); assert.ok(r.ok, JSON.stringify(r)); return r.ok ? r.corpo.lugares : []; };
  assert.deepEqual(ok({}), []);
  assert.deepEqual(ok({ lugares: null }), []);
  assert.deepEqual(ok({ lugares: [{ ingresso_id: A.toUpperCase(), assentos: [{ fileira: " c ", numero: 7 }, { fileira: "C", numero: 8 }] }] }), [{ ingresso_id: A, assentos: [{ fileira: "C", numero: 7 }, { fileira: "C", numero: 8 }] }]);
  const ruim = (lugares: unknown, itens = bom.itens) => lerCorpoDaCompra({ ...bom, itens, lugares });
  const dois = [{ fileira: "C", numero: 7 }, { fileira: "C", numero: 8 }];
  for (const [nome, lugares] of [
    ["não é lista", {}], ["quantidade que não bate", [{ ingresso_id: A, assentos: [{ fileira: "C", numero: 7 }] }]], ["ingresso fora do pedido", [{ ingresso_id: B, assentos: dois }]],
    ["ingresso repetido", [{ ingresso_id: A, assentos: dois }, { ingresso_id: A, assentos: dois }]], ["lugar repetido", [{ ingresso_id: A, assentos: [{ fileira: "C", numero: 7 }, { fileira: "c", numero: 7 }] }]],
    ["fileira ruim", [{ ingresso_id: A, assentos: [{ fileira: "C 1", numero: 7 }, { fileira: "C", numero: 8 }] }]], ["número ruim", [{ ingresso_id: A, assentos: [{ fileira: "C", numero: 0 }, { fileira: "C", numero: 8 }] }]],
    ["número que não é inteiro", [{ ingresso_id: A, assentos: [{ fileira: "C", numero: 1.5 }, { fileira: "C", numero: 8 }] }]], ["ingresso que não é UUID", [{ ingresso_id: "x", assentos: dois }]],
  ] as [string, unknown][]) {
    const r = ruim(lugares);
    assert.ok(!r.ok && r.problemas.includes("lugares"), nome);
  }
});

test("a compra manda os lugares para a reserva e uma recusa por lugar vira a frase do comprador", async () => {
  const vistos: unknown[] = [];
  const portas: PortasDaCompra = {
    async contaDaSessao() { return { chave: "chave-da-subconta-0123456789", aprovada: true }; },
    async reservar(corpo) { vistos.push(corpo.lugares); return { pedido_id: "0d7a0000-0000-4000-8000-0000000000e1", codigo: "ABCD2345", situacao: "pago", reservado_ate: "2026-11-21T12:15:00.000Z", total_centavos: 0, taxa_centavos: 0, produtor_centavos: 0 }; },
    async registrarAceite() {},
    async definirMeio() {},
    provedor() { throw new Error("pedido gratuito não abre cobrança"); },
    carteiraDoJards: "carteira",
  };
  const l = lerCorpoDaCompra({ ...bom, lugares: [{ ingresso_id: A, assentos: [{ fileira: "C", numero: 7 }, { fileira: "C", numero: 8 }] }] });
  assert.ok(l.ok);
  if (!l.ok) return;
  await iniciarCompra(l.corpo, portas);
  assert.deepEqual(vistos, [[{ ingresso_id: A, assentos: [{ fileira: "C", numero: 7 }, { fileira: "C", numero: 8 }] }]]);
  assert.equal(mensagemDoErroDaReserva({ message: "lugar_ocupado" }), "Alguém acabou de escolher um desses lugares. Escolha de novo.");
  assert.match(mensagemDoErroDaReserva({ message: "lugar_indisponivel" }), /não está mais à venda/);
  assert.match(mensagemDoErroDaReserva({ message: "lugares_obrigatorios" }), /Escolha os lugares no mapa/);
  for (const m of ["lugares_quantidade", "lugares_invalidos", "ingresso_sem_mapa"]) assert.match(mensagemDoErroDaReserva({ message: m }), /Escolha os lugares de novo/);
  assert.match(mensagemDoErroDaReserva({ message: "esgotado" }), /lugares/, "o esgotado dos ingressos segue com a frase de sempre");
  const recusada: PortasDaCompra = { ...portas, async reservar() { throw new ErroDaCompra("reserva_recusada", mensagemDoErroDaReserva({ message: "lugar_ocupado" })); } };
  await assert.rejects(() => iniciarCompra(l.corpo, recusada), (e: unknown) => e instanceof ErroDaCompra && e.codigo === "reserva_recusada" && /lugar/.test(e.mensagem));
});

test("o mapa da sessão: lido com cuidado, com os lugares escolhidos marcados e o limite da escolha", () => {
  const resposta = { setor: "Plateia", corredor: true, fileiras: [{ nome: "A", assentos: [{ numero: 1, estado: "livre" }, { numero: 2, estado: "ocupado" }] }, { nome: "B", assentos: [{ numero: 1, estado: "livre" }] }] };
  const m = lerMapaDaSessao(resposta);
  assert.ok(m);
  assert.equal(m?.setor, "Plateia");
  assert.equal(m?.corredor, true);
  assert.equal(lerMapaDaSessao({ ...resposta, corredor: false })?.corredor, false);
  for (const ruim of [null, {}, { setor: "P" }, { ...resposta, fileiras: [{ nome: "A", assentos: [{ numero: 1, estado: "bloqueado" }] }] }, { ...resposta, fileiras: [{ nome: "A", assentos: [{ numero: "1", estado: "livre" }] }] }, { ...resposta, fileiras: [null] }]) assert.equal(lerMapaDaSessao(ruim), null);
  const marcado = comEscolhidos(m!.fileiras, [{ fileira: "A", numero: 1 }, { fileira: "A", numero: 2 }, { fileira: "Z", numero: 9 }]);
  assert.equal(marcado[0].assentos[0].estado, "selecionado");
  assert.equal(marcado[0].assentos[1].estado, "ocupado", "um lugar ocupado não vira escolhido");
  assert.equal(marcado[1].assentos[0].estado, "livre");
  assert.equal(comCorredor(mapaDe(6), true)[0].vaos?.[0], 3);
  assert.equal(rotuloDoLugar("C", 7), "C7");
  let e = alternarEscolha([], "A", 1, 2);
  e = alternarEscolha(e, "A", 2, 2);
  assert.deepEqual(e.map(l => rotuloDoLugar(l.fileira, l.numero)), ["A1", "A2"], "na ordem em que a pessoa tocou");
  assert.equal(alternarEscolha(e, "B", 1, 2).length, 2, "passou do máximo: o lugar novo não entra");
  assert.deepEqual(alternarEscolha(e, "A", 1, 2).map(l => l.numero), [2], "tocar de novo solta o lugar");
});
function mapaDe(n: number) { return [{ nome: "A", assentos: Array.from({ length: n }, (_, i) => ({ numero: i + 1, estado: "livre" as const })) }]; }

test("as faixas de preço limitadas aos lugares livres do setor", () => {
  const faixas = [{ preco_centavos: 5000, livres: 2 }, { preco_centavos: 8000, livres: 3 }];
  assert.deepEqual(limitarFaixas(faixas, 10), faixas);
  assert.deepEqual(limitarFaixas(faixas, 3), [{ preco_centavos: 5000, livres: 2 }, { preco_centavos: 8000, livres: 1 }]);
  assert.deepEqual(limitarFaixas(faixas, 2), [{ preco_centavos: 5000, livres: 2 }]);
  assert.deepEqual(limitarFaixas(faixas, 0), []);
  assert.deepEqual(limitarFaixas(faixas, -1), []);
  assert.deepEqual(limitarFaixas([], 5), []);
});

test("o e-mail dos ingressos mostra o lugar; sem lugar fica como sempre", () => {
  const dados: IngressosDoPedido = { pedido_id: "p", codigo: "ABCD2345", comprador_nome: "Marina", evento: "Hamlet", inicio: "2026-11-29T23:00:00Z", fuso: "America/Sao_Paulo", local: "Teatro", cidade: "Sorocaba", uf: "SP", sessao_cancelada: false,
    ingressos: [{ codigo: "K7M2P9X4QA", nome: "Inteira", assento: "Plateia · Fileira C · lugar 7", preco_centavos: 6000, usado: false, cancelado: false }, { codigo: "R3T8W5N2HB", nome: "Meia", preco_centavos: 3000, usado: false, cancelado: false }] };
  const m = emailDosIngressos(dados, "https://jards.com.br/pedido/p");
  assert.ok(m.texto.includes("Inteira (Plateia · Fileira C · lugar 7): K7M2P9X4QA") && m.texto.includes("Meia: R3T8W5N2HB"));
  assert.ok(m.html.includes("Inteira (Plateia · Fileira C · lugar 7)") && m.html.includes("<li>Meia: <strong"));
});

test("os erros do mapa do produtor sobre lugares vendidos", () => {
  assert.match(mensagemDoErroDoMapa({ message: "lugar_vendido" }), /vendido ou reservado/);
  assert.match(mensagemDoErroDoMapa({ message: "setor_com_lugares_vendidos" }), /desligar os lugares numerados/);
});

const evento = { titulo: "Hamlet", quando: "sáb., 29 nov. · 20h", local: "Teatro" };
const site = { titulo: "Cia" };

test("a escolha dos ingressos: setor numerado pede os lugares, mostra os escolhidos e o aviso; esgotado segue como antes", () => {
  const ingressos = [
    { id: "i1", nome: "Inteira", descricao: null, limite: 10, faixas: [{ preco_centavos: 6000, livres: 5 }], numerado: { setor: "Plateia" } },
    { id: "i2", nome: "Meia", descricao: null, limite: 10, faixas: [], numerado: { setor: "Plateia" } },
    { id: "i3", nome: "Pista", descricao: null, limite: 10, faixas: [{ preco_centavos: 2000, livres: 5 }] },
  ];
  const sem = html(createElement(TelaEscolherIngressos, { site, evento, ingressos, quantidades: {}, onEscolherLugares: () => {}, onEntrarNaEspera: () => {} }));
  assert.ok(sem.includes("Plateia · lugares numerados") && sem.includes("Escolher lugares") && !sem.includes("Trocar lugares"));
  assert.equal((sem.match(/Escolher lugares/g) ?? []).length, 1, "o ingresso esgotado não pede lugares");
  assert.ok(sem.includes("Esgotado") && sem.includes("Avise-me se voltar") && sem.includes('aria-label="Quantidade de Pista"'), "esgotado e setor comum seguem como antes");
  const com = html(createElement(TelaEscolherIngressos, { site, evento, ingressos, quantidades: { i1: 2 }, lugaresEscolhidos: { i1: ["C7", "C8"] }, aviso: "Alguém acabou de escolher um desses lugares. Escolha de novo.", onEscolherLugares: () => {} }));
  for (const t of ["Trocar lugares", "C7", "C8", "Limpar", "Alguém acabou de escolher", 'role="alert"', "R$ 120,00"]) assert.ok(com.includes(t), `falta: ${t}`);
});

test("a tela do mapa da compra: carregando, erro e pronto", () => {
  const props = { site, evento, ingresso: { nome: "Inteira", preco_centavos: 6000 }, setor: "Plateia", fileiras: [], escolhidos: [], max: 4, totalCentavos: 0 };
  assert.ok(html(createElement(TelaEscolherLugares, { ...props, carregando: true })).includes("Carregando o mapa"));
  const erro = html(createElement(TelaEscolherLugares, { ...props, erroDoMapa: "Não foi possível carregar o mapa. Tente de novo." }));
  assert.ok(erro.includes('role="alert"') && erro.includes("Tentar de novo") && !erro.includes("Ampliar o mapa"));
  const pronto = html(createElement(TelaEscolherLugares, { ...props, fileiras: mapaDe(4) }));
  assert.ok(pronto.includes("Ampliar o mapa") && pronto.includes("Seu lugar") && !pronto.includes("Carregando"));
});
